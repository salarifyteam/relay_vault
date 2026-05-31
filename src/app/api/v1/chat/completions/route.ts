import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  providerFromModel,
  upstreamUrl,
  authHeaders,
  OPENAI_COMPATIBLE,
} from "@/lib/providerRouting";
import { anthropicAdapter } from "@/lib/providers/anthropic";
import { googleAdapter } from "@/lib/providers/google";
import { toOpenAIError, type OAIRequest, type ProviderAdapter } from "@/lib/providers/shared";
import {
  assertBodySize,
  authenticateAndAuthorize,
  recordUsage,
  meterStream,
  SSE_HEADERS,
} from "@/lib/proxyCommon";
import { relayError } from "@/lib/errors/relayError";
import { upstreamFetch } from "@/lib/upstreamFetch";
import { logInfo, logWarn } from "@/lib/log";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 30_000;

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  logInfo("request_start", { requestId });

  const tooLarge = assertBodySize(req, requestId);
  if (tooLarge) return tooLarge;

  let body: OAIRequest;
  try {
    body = (await req.json()) as OAIRequest;
  } catch {
    return relayError("invalid_json", "Invalid JSON body", requestId);
  }
  const model = body.model;
  if (!model || typeof model !== "string") {
    return relayError("model_missing", "Missing 'model' in request body", requestId);
  }
  const isStream = body.stream === true;

  const provider = providerFromModel(model);
  if (!provider) {
    return relayError("model_unknown", `Unknown model '${model}' — cannot route to a provider`, requestId);
  }

  const authz = await authenticateAndAuthorize(req, { provider, model, requestId });
  if (!authz.ok) return authz.response;
  const { apiKey, ids } = authz.ctx;

  const sseHeaders = { ...SSE_HEADERS, "X-Relay-Request-Id": requestId };

  // OpenAI 호환 계열(openai/xai/zai): 형식 변환 없이 passthrough
  if (OPENAI_COMPATIBLE.includes(provider)) {
    const upstreamBody = isStream ? { ...body, stream_options: { include_usage: true } } : body;
    const upstream = await upstreamFetch(
      upstreamUrl(provider),
      { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders(apiKey) }, body: JSON.stringify(upstreamBody) },
      { timeoutMs: TIMEOUT_MS, provider, requestId }
    );

    if (!upstream.ok || !isStream || !upstream.body) {
      const text = await upstream.text();
      if (upstream.ok && !isStream) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.usage) await recordUsage({ ...ids, usage: parsed.usage, stream: false });
        } catch {
          /* 비JSON 응답이면 계량 생략 */
        }
      } else if (!upstream.ok) {
        logWarn("upstream_error", { requestId, provider, model, status: upstream.status });
      }
      logInfo("request_end", { requestId, provider, model, status: upstream.status, latencyMs: Date.now() - startedAt, stream: false });
      return new NextResponse(text, { status: upstream.status, headers: { "Content-Type": "application/json", "X-Relay-Request-Id": requestId } });
    }

    const stream = meterStream(upstream, async (usage) => {
      await recordUsage({ ...ids, usage, stream: true });
      logInfo("request_end", { requestId, provider, model, status: 200, latencyMs: Date.now() - startedAt, stream: true });
    });
    return new NextResponse(stream, { status: 200, headers: sseHeaders });
  }

  // 번역 필요 계열(anthropic/google): 어댑터로 OpenAI 형식 ↔ 프로바이더 형식 변환
  const adapter: ProviderAdapter = provider === "anthropic" ? anthropicAdapter : googleAdapter;
  const reqParams = adapter.buildRequest(body, apiKey, isStream);
  const upstream = await upstreamFetch(
    reqParams.url,
    { method: "POST", headers: reqParams.headers, body: JSON.stringify(reqParams.body) },
    { timeoutMs: TIMEOUT_MS, provider, requestId }
  );

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    logWarn("upstream_error", { requestId, provider, model, status: upstream.status });
    logInfo("request_end", { requestId, provider, model, status: upstream.status, latencyMs: Date.now() - startedAt, stream: false });
    return NextResponse.json(toOpenAIError(provider, text), { status: upstream.status, headers: { "X-Relay-Request-Id": requestId } });
  }

  if (isStream) {
    const stream = adapter.streamToOpenAI(upstream.body, model, async (usage) => {
      await recordUsage({ ...ids, usage, stream: true });
      logInfo("request_end", { requestId, provider, model, status: 200, latencyMs: Date.now() - startedAt, stream: true });
    });
    return new NextResponse(stream, { status: 200, headers: sseHeaders });
  }

  const data = await upstream.json();
  const openaiResponse = adapter.responseToOpenAI(data, model);
  await recordUsage({ ...ids, usage: openaiResponse.usage, stream: false });
  logInfo("request_end", { requestId, provider, model, status: 200, latencyMs: Date.now() - startedAt, stream: false });
  return NextResponse.json(openaiResponse, { headers: { "X-Relay-Request-Id": requestId } });
}
