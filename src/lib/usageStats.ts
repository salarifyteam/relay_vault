import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import UsageRecord from "@/lib/models/UsageRecord";
import EndUserKey from "@/lib/models/EndUserKey";

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

// 제공자(테넌트) 단위 — 모든 엔드유저에 걸친 이번 달 집계
export async function getTenantUsage(tenantId: string, recentLimit = 8): Promise<TenantUsage> {
  await dbConnect();
  const tid = new mongoose.Types.ObjectId(tenantId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [agg, endUsers, recentDocs] = await Promise.all([
    UsageRecord.aggregate<{ requests: number; costUsd: number }>([
      { $match: { tenantId: tid, createdAt: { $gte: monthStart } } },
      {
        $group: {
          _id: null,
          requests: { $sum: 1 },
          costUsd: { $sum: "$estimatedCostUsd" },
        },
      },
    ]),
    EndUserKey.countDocuments({ tenantId: tid, isActive: true }),
    UsageRecord.find({ tenantId: tid })
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

export interface EndUserRow {
  endUserLabel: string;
  provider: string;
  keyMasked: string;
  validationState: string;
  spentUsd: number;
  lastValidatedAt?: Date;
}

// 제공자 테넌트에 연결된 엔드유저(=각자 BYOK 키) 목록
export async function getTenantEndUsers(tenantId: string): Promise<EndUserRow[]> {
  await dbConnect();
  const tid = new mongoose.Types.ObjectId(tenantId);
  const docs = await EndUserKey.find({ tenantId: tid })
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
  return docs.map((d) => ({
    endUserLabel: d.endUserLabel,
    provider: d.provider,
    keyMasked: d.keyMasked,
    validationState: d.validationState,
    spentUsd: d.spentUsd || 0,
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
