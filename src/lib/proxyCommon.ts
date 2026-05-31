import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import Tenant, { type ITenant } from "@/lib/models/Tenant";
import ApiKey from "@/lib/models/ApiKey";
import EndUserKey, { type IEndUserKey } from "@/lib/models/EndUserKey";
import UsageRecord from "@/lib/models/UsageRecord";
import { getCrypto } from "@/lib/crypto";
import { checkRequest } from "@/lib/governance/checkRequest";
import { getActiveKeyStats, isKeyActiveThisMonth } from "@/lib/usageStats";
import { PLANS } from "@/lib/billing/plans";
import { checkRateLimit } from "@/lib/rateLimit";
import { normalizeUsage, estimateCostUsd } from "@/lib/costCalculator";
import { hashApiKey, type Environment } from "@/lib/keys";
import { relayError } from "@/lib/errors/relayError";
import { logWarn } from "@/lib/log";
import type { ByokProvider } from "@/lib/services/byokProvider";

export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

const MAX_BODY_BYTES = 1_000_000;

// Content-Length 기반 본문 크기 제한. (위조 가능 → Cloud Run 자체 한도가 백스톱)
export function assertBodySize(req: NextRequest, requestId: string): NextResponse | null {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY_BYTES) {
    return relayError("request_too_large", "Request body too large (max 1MB)", requestId);
  }
  return null;
}

export interface ProxyIds {
  tenantId: mongoose.Types.ObjectId;
  environment: Environment;
  endUserKeyId: mongoose.Types.ObjectId;
  endUserLabel: string;
  provider: ByokProvider;
  model: string;
  isPaid: boolean;
  requestId: string;
}

export interface AuthContext {
  tenant: ITenant;
  environment: Environment;
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
  const secret = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  // rly_live_… / rly_test_…(신규) 와 rly-…(레거시) 모두 허용.
  if (!/^rly[_-]/.test(secret)) {
    return { ok: false, response: relayError("relay_key_invalid", "Missing or invalid Relay key (expected 'Bearer rly_...')", requestId) };
  }

  const endUserLabel = req.headers.get("x-relay-user")?.trim();
  if (!endUserLabel) {
    return { ok: false, response: relayError("user_header_missing", "Missing X-Relay-User header", requestId) };
  }
  const isPaid = req.headers.get("x-relay-paid")?.trim().toLowerCase() !== "false";

  await dbConnect();

  // 키 해시로 ApiKey 조회 → 테넌트 + 환경(test/live) 도출. 평문은 DB에 없다.
  const apiKeyDoc = await ApiKey.findOne({ keyHash: hashApiKey(secret), status: "active" });
  if (!apiKeyDoc) {
    return { ok: false, response: relayError("relay_key_revoked", "Unknown or revoked Relay key", requestId) };
  }
  const tenant = await Tenant.findById(apiKeyDoc.tenantId);
  if (!tenant || tenant.status !== "active") {
    return { ok: false, response: relayError("relay_tenant_disabled", "Unknown or disabled Relay key", requestId) };
  }
  const tid = tenant._id as mongoose.Types.ObjectId;
  const environment = apiKeyDoc.environment;

  // lastUsedAt 베스트에포트(차단·계량 흐름을 막지 않도록 await만, 실패 무시)
  ApiKey.updateOne({ _id: apiKeyDoc._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

  // 레이트리밋(테넌트×환경별 분당) — 스로틀된 요청은 복호화하지 않도록 일찍 검사
  const rl = await checkRateLimit(tid, environment, PLANS[tenant.plan].reqPerMin);
  if (!rl.ok) {
    logWarn("rate_limited", { requestId, tenantId: String(tid), environment, provider, model });
    const res = relayError("rate_limit_exceeded", `Rate limit exceeded (${PLANS[tenant.plan].reqPerMin}/min for the ${PLANS[tenant.plan].label} plan)`, requestId);
    res.headers.set("Retry-After", String(rl.retryAfterSec));
    return { ok: false, response: res };
  }

  const endUserKey = await EndUserKey.findOne({ tenantId: tid, environment, endUserLabel, provider, isActive: true });
  if (!endUserKey || endUserKey.validationState === "invalid") {
    return { ok: false, response: relayError("enduser_key_missing", `No usable ${provider} key registered for user '${endUserLabel}'`, requestId) };
  }

  const gate = checkRequest({ endUserKey, tenant, model });
  if (!gate.allow) {
    // gate가 code를 명명하면 그걸 쓰고, 아니면 spend_cap_exceeded(현재 유일한 gate)로 폴백.
    return { ok: false, response: relayError(gate.code ?? "spend_cap_exceeded", gate.reason || "Request blocked by policy", requestId) };
  }

  // Free 플랜 활성키 하드캡(환경별): 신규 키만 차단(이미 활성인 키는 통과). 유료 플랜은 조회 자체를 건너뜀.
  const hardCap = PLANS[tenant.plan].hardCapKeys;
  if (hardCap != null) {
    const alreadyActive = await isKeyActiveThisMonth(tid, environment, endUserLabel, provider);
    if (!alreadyActive) {
      const { allActiveKeys } = await getActiveKeyStats(String(tid), environment);
      if (allActiveKeys >= hardCap) {
        return { ok: false, response: relayError("active_key_limit", `Active-key limit reached for the ${PLANS[tenant.plan].label} plan (${hardCap}). Upgrade to add more end-user keys.`, requestId) };
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
    return { ok: false, response: relayError("key_decrypt_failed", "Failed to decrypt stored key", requestId) };
  }

  const ids: ProxyIds = {
    tenantId: tid,
    environment,
    endUserKeyId: endUserKey._id as mongoose.Types.ObjectId,
    endUserLabel,
    provider,
    model,
    isPaid,
    requestId,
  };

  return { ok: true, ctx: { tenant, environment, endUserKey, apiKey, provider, endUserLabel, isPaid, ids } };
}

// 사용량 기록 + 엔드유저 키 활성/지출 갱신. requestId는 Relay 자체 ID(로그·헤더의 조인 키).
export async function recordUsage(params: {
  tenantId: mongoose.Types.ObjectId;
  environment: Environment;
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
    environment: params.environment,
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
