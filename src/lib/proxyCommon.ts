import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import Tenant, { type ITenant } from "@/lib/models/Tenant";
import EndUserKey, { type IEndUserKey } from "@/lib/models/EndUserKey";
import UsageRecord from "@/lib/models/UsageRecord";
import { getCrypto } from "@/lib/crypto";
import { checkRequest } from "@/lib/governance/checkRequest";
import { getActiveKeyStats, isKeyActiveThisMonth } from "@/lib/usageStats";
import { PLANS } from "@/lib/billing/plans";
import { checkRateLimit } from "@/lib/rateLimit";
import { normalizeUsage, estimateCostUsd } from "@/lib/costCalculator";
import { logWarn } from "@/lib/log";
import type { ByokProvider } from "@/lib/services/byokProvider";

export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

const MAX_BODY_BYTES = 1_000_000;

// OpenAI 형식 에러 응답. 모든 출구가 X-Relay-Request-Id를 달도록 requestId를 받는다.
export function oaiError(
  message: string,
  status: number,
  type = "invalid_request_error",
  requestId?: string
) {
  const headers: Record<string, string> = {};
  if (requestId) headers["X-Relay-Request-Id"] = requestId;
  return NextResponse.json({ error: { message, type } }, { status, headers });
}

// Content-Length 기반 본문 크기 제한. (위조 가능 → Cloud Run 자체 한도가 백스톱)
export function assertBodySize(req: NextRequest, requestId: string): NextResponse | null {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY_BYTES) {
    return oaiError("Request body too large (max 1MB)", 413, "invalid_request_error", requestId);
  }
  return null;
}

export interface ProxyIds {
  tenantId: mongoose.Types.ObjectId;
  endUserKeyId: mongoose.Types.ObjectId;
  endUserLabel: string;
  provider: ByokProvider;
  model: string;
  isPaid: boolean;
  requestId: string;
}

export interface AuthContext {
  tenant: ITenant;
  endUserKey: IEndUserKey;
  apiKey: string;
  provider: ByokProvider;
  endUserLabel: string;
  isPaid: boolean;
  ids: ProxyIds;
}

export type AuthResult =
  | { ok: false; response: NextResponse }
  | { ok: true; ctx: AuthContext };

// 프록시 공통 파이프라인: rly-키 → X-Relay-User → DB → 테넌트 → 레이트리밋
// → 엔드유저 키 → 거버넌스 → Free 활성키캡 → 복호화. 준비된 에러 응답 또는 ctx 반환.
// model/provider는 라우트가 본문을 파싱해 도출한 뒤 넘긴다(chat/embeddings 본문 형식이 달라서).
export async function authenticateAndAuthorize(
  req: NextRequest,
  params: { provider: ByokProvider; model: string; requestId: string }
): Promise<AuthResult> {
  const { provider, model, requestId } = params;

  const auth = req.headers.get("authorization") || "";
  const rlyKey = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!rlyKey.startsWith("rly-")) {
    return { ok: false, response: oaiError("Missing or invalid Relay key (expected 'Bearer rly-...')", 401, "invalid_request_error", requestId) };
  }

  const endUserLabel = req.headers.get("x-relay-user")?.trim();
  if (!endUserLabel) {
    return { ok: false, response: oaiError("Missing X-Relay-User header", 400, "invalid_request_error", requestId) };
  }
  const isPaid = req.headers.get("x-relay-paid")?.trim().toLowerCase() !== "false";

  await dbConnect();

  const tenant = await Tenant.findOne({ rlyKey, status: "active" });
  if (!tenant) {
    return { ok: false, response: oaiError("Unknown or disabled Relay key", 401, "invalid_request_error", requestId) };
  }
  const tid = tenant._id as mongoose.Types.ObjectId;

  // 레이트리밋(테넌트별 분당) — 스로틀된 요청은 복호화하지 않도록 일찍 검사
  const rl = await checkRateLimit(tid, PLANS[tenant.plan].reqPerMin);
  if (!rl.ok) {
    logWarn("rate_limited", { requestId, tenantId: String(tid), provider, model });
    const res = oaiError(`Rate limit exceeded (${PLANS[tenant.plan].reqPerMin}/min for the ${PLANS[tenant.plan].label} plan)`, 429, "rate_limit_error", requestId);
    res.headers.set("Retry-After", String(rl.retryAfterSec));
    return { ok: false, response: res };
  }

  const endUserKey = await EndUserKey.findOne({ tenantId: tid, endUserLabel, provider, isActive: true });
  if (!endUserKey || endUserKey.validationState === "invalid") {
    return { ok: false, response: oaiError(`No usable ${provider} key registered for user '${endUserLabel}'`, 404, "invalid_request_error", requestId) };
  }

  const gate = checkRequest({ endUserKey, tenant, model });
  if (!gate.allow) {
    return { ok: false, response: oaiError(gate.reason || "Request blocked by policy", gate.status || 403, "invalid_request_error", requestId) };
  }

  // Free 플랜 활성키 하드캡: 신규 키만 차단(이미 활성인 키는 통과). 유료 플랜은 조회 자체를 건너뜀.
  const hardCap = PLANS[tenant.plan].hardCapKeys;
  if (hardCap != null) {
    const alreadyActive = await isKeyActiveThisMonth(tid, endUserLabel, provider);
    if (!alreadyActive) {
      const { allActiveKeys } = await getActiveKeyStats(String(tid));
      if (allActiveKeys >= hardCap) {
        return { ok: false, response: oaiError(`Active-key limit reached for the ${PLANS[tenant.plan].label} plan (${hardCap}). Upgrade to add more end-user keys.`, 429, "rate_limit_error", requestId) };
      }
    }
  }

  let apiKey: string;
  try {
    apiKey = await getCrypto().open(
      { ciphertext: endUserKey.keyEncrypted, cryptoVersion: endUserKey.cryptoVersion, wrappedDataKey: endUserKey.wrappedDataKey },
      { tenantId: String(tid) }
    );
  } catch {
    return { ok: false, response: oaiError("Failed to decrypt stored key", 500, "api_error", requestId) };
  }

  const ids: ProxyIds = {
    tenantId: tid,
    endUserKeyId: endUserKey._id as mongoose.Types.ObjectId,
    endUserLabel,
    provider,
    model,
    isPaid,
    requestId,
  };

  return { ok: true, ctx: { tenant, endUserKey, apiKey, provider, endUserLabel, isPaid, ids } };
}

// 사용량 기록 + 엔드유저 키 활성/지출 갱신. requestId는 Relay 자체 ID(로그·헤더의 조인 키).
export async function recordUsage(params: {
  tenantId: mongoose.Types.ObjectId;
  endUserKeyId: mongoose.Types.ObjectId;
  endUserLabel: string;
  provider: ByokProvider;
  model: string;
  isPaid: boolean;
  usage: unknown;
  stream: boolean;
  requestId?: string;
}) {
  const tokens = normalizeUsage(params.usage);
  const cost = estimateCostUsd(params.model, tokens);
  await UsageRecord.create({
    tenantId: params.tenantId,
    endUserLabel: params.endUserLabel,
    provider: params.provider,
    modelName: params.model,
    inputTokens: tokens.inputTokens,
    outputTokens: tokens.outputTokens,
    cachedInputTokens: tokens.cachedInputTokens,
    estimatedCostUsd: cost,
    stream: params.stream,
    requestId: params.requestId,
  });
  await EndUserKey.updateOne(
    { _id: params.endUserKeyId },
    { $inc: { spentUsd: cost }, $set: { isPaid: params.isPaid } }
  );
}

// OpenAI 호환 업스트림 SSE를 그대로 흘려보내며 usage 청크만 가로채 계량
export function meterStream(
  upstream: Response,
  onDone: (usage: unknown) => Promise<void>
): ReadableStream<Uint8Array> {
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: unknown = null;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        if (usage) {
          try {
            await onDone(usage);
          } catch {
            /* 계량 실패는 응답을 막지 않음 */
          }
        }
        controller.close();
        return;
      }
      controller.enqueue(value);
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line.startsWith("data:")) {
          const payload = line.slice(5).trim();
          if (payload && payload !== "[DONE]") {
            try {
              const obj = JSON.parse(payload);
              if (obj.usage) usage = obj.usage;
            } catch {
              /* 부분 청크 무시 */
            }
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}
