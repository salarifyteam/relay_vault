import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import UsageRecord from "@/lib/models/UsageRecord";
import EndUserKey from "@/lib/models/EndUserKey";
import type { ByokProvider } from "@/lib/services/byokProvider";
import type { Environment } from "@/lib/keys";

// 청구월 시작(이번 달 1일 00:00, 서버 로컬). 활성키·사용량 집계가 공유.
export function currentMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export interface RecentRequest {
  model: string;
  endUserLabel: string;
  inputTokens: number;
  outputTokens: number;
  stream: boolean;
  createdAt: Date;
}

export interface TenantUsage {
  requests: number;
  costUsd: number;
  endUsers: number;
  recent: RecentRequest[];
}

// 제공자(테넌트) 단위 — 모든 엔드유저에 걸친 이번 달 집계.
// environment 생략 시 전체 환경 합산(현재 대시보드 동작 유지). 지정 시 해당 환경만.
export async function getTenantUsage(
  tenantId: string,
  recentLimit = 8,
  environment?: Environment
): Promise<TenantUsage> {
  await dbConnect();
  const tid = new mongoose.Types.ObjectId(tenantId);
  const monthStart = currentMonthStart();
  const envFilter = environment ? { environment } : {};

  const [agg, endUsers, recentDocs] = await Promise.all([
    UsageRecord.aggregate<{ requests: number; costUsd: number }>([
      { $match: { tenantId: tid, ...envFilter, createdAt: { $gte: monthStart } } },
      {
        $group: {
          _id: null,
          requests: { $sum: 1 },
          costUsd: { $sum: "$estimatedCostUsd" },
        },
      },
    ]),
    EndUserKey.countDocuments({ tenantId: tid, ...envFilter, isActive: true }),
    UsageRecord.find({ tenantId: tid, ...envFilter })
      .sort({ createdAt: -1 })
      .limit(recentLimit)
      .lean(),
  ]);

  const summary = agg[0] || { requests: 0, costUsd: 0 };
  return {
    requests: summary.requests,
    costUsd: summary.costUsd,
    endUsers,
    recent: recentDocs.map((d) => ({
      model: d.modelName,
      endUserLabel: d.endUserLabel,
      inputTokens: d.inputTokens,
      outputTokens: d.outputTokens,
      stream: d.stream,
      createdAt: d.createdAt,
    })),
  };
}

export interface ActiveKeyStats {
  allActiveKeys: number; // 이번 달 성공 요청 ≥1건인 distinct BYOK 키
  paidActiveKeys: number; // 그중 isPaid=true (청구 기준)
}

// 과금 단위 집계: 청구월에 성공 요청이 있었던 distinct (endUserLabel, provider) 키 수.
// distinct 키를 구한 뒤 enduserkeys로 조인해 isPaid 분리.
// environment로 격리 — Free 하드캡이 환경별로 적용되므로 양쪽($match·$lookup)을 모두 환경 제약.
export async function getActiveKeyStats(
  tenantId: string,
  environment: Environment
): Promise<ActiveKeyStats> {
  await dbConnect();
  const tid = new mongoose.Types.ObjectId(tenantId);
  const monthStart = currentMonthStart();

  const agg = await UsageRecord.aggregate<{ allActiveKeys: number; paidActiveKeys: number }>([
    { $match: { tenantId: tid, environment, createdAt: { $gte: monthStart } } },
    { $group: { _id: { label: "$endUserLabel", provider: "$provider" } } },
    {
      $lookup: {
        from: "enduserkeys",
        let: { l: "$_id.label", p: "$_id.provider" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$tenantId", tid] },
                  { $eq: ["$environment", environment] },
                  { $eq: ["$endUserLabel", "$$l"] },
                  { $eq: ["$provider", "$$p"] },
                ],
              },
            },
          },
          { $project: { isPaid: 1 } },
        ],
        as: "k",
      },
    },
    {
      $group: {
        _id: null,
        allActiveKeys: { $sum: 1 },
        // 키 문서가 없거나(이미 삭제) isPaid!==false 면 유료로 카운트
        paidActiveKeys: {
          $sum: { $cond: [{ $eq: [{ $arrayElemAt: ["$k.isPaid", 0] }, false] }, 0, 1] },
        },
      },
    },
  ]);

  return agg[0] ? { allActiveKeys: agg[0].allActiveKeys, paidActiveKeys: agg[0].paidActiveKeys } : { allActiveKeys: 0, paidActiveKeys: 0 };
}

// 이 키가 이번 청구월에 이미 활성(성공 요청 ≥1건)인지. Free 하드캡이 신규 키만 막도록 쓰임.
export async function isKeyActiveThisMonth(
  tenantId: mongoose.Types.ObjectId,
  environment: Environment,
  endUserLabel: string,
  provider: ByokProvider
): Promise<boolean> {
  const exists = await UsageRecord.exists({
    tenantId,
    environment,
    endUserLabel,
    provider,
    createdAt: { $gte: currentMonthStart() },
  });
  return exists != null;
}

export interface EndUserRow {
  endUserLabel: string;
  provider: string;
  keyMasked: string;
  validationState: string;
  spentUsd: number;
  spendCapUsd?: number;
  isActive: boolean;
  lastValidatedAt?: Date;
}

// 제공자 테넌트에 연결된 엔드유저(=각자 BYOK 키) 목록.
// environment 생략 시 전체 환경(현재 동작 유지). 지정 시 해당 환경만.
export async function getTenantEndUsers(
  tenantId: string,
  environment?: Environment
): Promise<EndUserRow[]> {
  await dbConnect();
  const tid = new mongoose.Types.ObjectId(tenantId);
  const docs = await EndUserKey.find({ tenantId: tid, ...(environment ? { environment } : {}) })
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
  return docs.map((d) => ({
    endUserLabel: d.endUserLabel,
    provider: d.provider,
    keyMasked: d.keyMasked,
    validationState: d.validationState,
    spentUsd: d.spentUsd || 0,
    spendCapUsd: d.spendCapUsd,
    isActive: d.isActive,
    lastValidatedAt: d.lastValidatedAt,
  }));
}

export function relativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
