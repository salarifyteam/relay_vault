import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import Tenant from "@/lib/models/Tenant";
import EndUserKey from "@/lib/models/EndUserKey";
import UsageRecord from "@/lib/models/UsageRecord";
import { getCrypto } from "@/lib/crypto";
import {
  providerFromModel,
  upstreamUrl,
  authHeaders,
  OPENAI_COMPATIBLE,
} from "@/lib/providerRouting";
import type { ByokProvider } from "@/lib/services/byokProvider";
import { normalizeUsage, estimateCostUsd } from "@/lib/costCalculator";
import { checkRequest } from "@/lib/governance/checkRequest";
import { anthropicAdapter } from "@/lib/providers/anthropic";
import { googleAdapter } from "@/lib/providers/google";
import {
  toOpenAIError,
  type OAIRequest,
  type ProviderAdapter,
} from "@/lib/providers/shared";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

function oaiError(message: string, status: number, type = "invalid_request_error") {
  return NextResponse.json({ error: { message, type } }, { status });
}

async function recordUsage(params: {
  tenantId: mongoose.Types.ObjectId;
  endUserKeyId: mongoose.Types.ObjectId;
  endUserLabel: string;
  provider: ByokProvider;
  model: string;
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
    { $inc: { spentUsd: cost } }
  );
}

// OpenAI 호환 업스트림 SSE를 그대로 흘려보내며 usage 청크만 가로채 계량
function meterStream(
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

export async function POST(req: NextRequest) {
  // 1) 테넌트 인증 (rly- 키)
  const auth = req.headers.get("authorization") || "";
  const rlyKey = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!rlyKey.startsWith("rly-")) {
    return oaiError("Missing or invalid Relay key (expected 'Bearer rly-...')", 401);
  }

  // 2) 엔드유저 식별
  const endUserLabel = req.headers.get("x-relay-user")?.trim();
  if (!endUserLabel) {
    return oaiError("Missing X-Relay-User header", 400);
  }

  // 3) 요청 본문
  let body: OAIRequest;
  try {
    body = (await req.json()) as OAIRequest;
  } catch {
    return oaiError("Invalid JSON body", 400);
  }
  const model = body.model;
  if (!model || typeof model !== "string") {
    return oaiError("Missing 'model' in request body", 400);
  }
  const isStream = body.stream === true;

  // 4) model → provider 도출
  const provider = providerFromModel(model);
  if (!provider) {
    return oaiError(`Unknown model '${model}' — cannot route to a provider`, 400);
  }

  await dbConnect();

  const tenant = await Tenant.findOne({ rlyKey, status: "active" });
  if (!tenant) {
    return oaiError("Unknown or disabled Relay key", 401);
  }

  const endUserKey = await EndUserKey.findOne({
    tenantId: tenant._id,
    endUserLabel,
    provider,
    isActive: true,
  });
  if (!endUserKey || endUserKey.validationState === "invalid") {
    return oaiError(
      `No usable ${provider} key registered for user '${endUserLabel}'`,
      404
    );
  }

  // 4.5) 거버넌스 (캡/모델)
  const gate = checkRequest({ endUserKey, tenant, model });
  if (!gate.allow) {
    return oaiError(gate.reason || "Request blocked by policy", gate.status || 403);
  }

  // 5) 복호화 (프록시 시점에만)
  let apiKey: string;
  try {
    apiKey = await getCrypto().open(
      {
        ciphertext: endUserKey.keyEncrypted,
        cryptoVersion: endUserKey.cryptoVersion,
        wrappedDataKey: endUserKey.wrappedDataKey,
      },
      { tenantId: String(tenant._id) }
    );
  } catch {
    return oaiError("Failed to decrypt stored key", 500);
  }

  const ids = {
    tenantId: tenant._id as mongoose.Types.ObjectId,
    endUserKeyId: endUserKey._id as mongoose.Types.ObjectId,
    endUserLabel,
    provider,
    model,
  };

  // 6) OpenAI 호환 계열(openai/xai/zai): 형식 변환 없이 passthrough
  if (OPENAI_COMPATIBLE.includes(provider)) {
    const upstreamBody = isStream
      ? { ...body, stream_options: { include_usage: true } }
      : body;
    const upstream = await fetch(upstreamUrl(provider), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(apiKey) },
      body: JSON.stringify(upstreamBody),
    });

    if (!upstream.ok || !isStream || !upstream.body) {
      const text = await upstream.text();
      if (upstream.ok && !isStream) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.usage) {
            await recordUsage({ ...ids, usage: parsed.usage, stream: false, requestId: parsed.id });
          }
        } catch {
          /* 비JSON 응답이면 계량 생략 */
        }
      }
      return new NextResponse(text, {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stream = meterStream(upstream, async (usage) => {
      await recordUsage({ ...ids, usage, stream: true });
    });
    return new NextResponse(stream, { status: 200, headers: SSE_HEADERS });
  }

  // 7) 번역 필요 계열(anthropic/google): 어댑터로 OpenAI 형식 ↔ 프로바이더 형식 변환
  const adapter: ProviderAdapter =
    provider === "anthropic" ? anthropicAdapter : googleAdapter;
  const reqParams = adapter.buildRequest(body, apiKey, isStream);
  const upstream = await fetch(reqParams.url, {
    method: "POST",
    headers: reqParams.headers,
    body: JSON.stringify(reqParams.body),
  });

  if (!upstream.ok || !upstream.body) {
    // 업스트림 에러를 OpenAI 형식으로 정규화 (개발자의 OpenAI 클라이언트 호환)
    const text = await upstream.text();
    return NextResponse.json(toOpenAIError(provider, text), {
      status: upstream.status,
    });
  }

  if (isStream) {
    const stream = adapter.streamToOpenAI(upstream.body, model, async (usage) => {
      await recordUsage({ ...ids, usage, stream: true });
    });
    return new NextResponse(stream, { status: 200, headers: SSE_HEADERS });
  }

  const data = await upstream.json();
  const openaiResponse = adapter.responseToOpenAI(data, model);
  await recordUsage({
    ...ids,
    usage: openaiResponse.usage,
    stream: false,
    requestId: openaiResponse.id,
  });
  return NextResponse.json(openaiResponse);
}
