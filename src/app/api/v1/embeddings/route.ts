import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  providerFromEmbeddingModel,
  upstreamUrl,
  authHeaders,
  OPENAI_COMPATIBLE,
} from "@/lib/providerRouting";
import { buildEmbedRequest, inputsOf, valuesFromEmbed, embeddingsResponseToOpenAI } from "@/lib/providers/googleEmbeddings";
import { oaiError, assertBodySize, authenticateAndAuthorize, recordUsage } from "@/lib/proxyCommon";
import { upstreamFetch } from "@/lib/upstreamFetch";
import { logInfo, logWarn } from "@/lib/log";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 30_000;

interface EmbeddingsBody {
  model?: string;
  input?: string | string[];
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  logInfo("request_start", { requestId });

  const tooLarge = assertBodySize(req, requestId);
  if (tooLarge) return tooLarge;

  let body: EmbeddingsBody;
  try {
    body = (await req.json()) as EmbeddingsBody;
  } catch {
    return oaiError("Invalid JSON body", 400, "invalid_request_error", requestId);
  }
  const model = body.model;
  if (!model || typeof model !== "string") {
    return oaiError("Missing 'model' in request body", 400, "invalid_request_error", requestId);
  }
  if (body.input == null || (typeof body.input !== "string" && !Array.isArray(body.input))) {
    return oaiError("Missing or invalid 'input' in request body", 400, "invalid_request_error", requestId);
  }

  const provider = providerFromEmbeddingModel(model);
  if (!provider) {
    return oaiError(`Unknown embedding model '${model}' — cannot route to a provider`, 400, "invalid_request_error", requestId);
  }
  // anthropic은 임베딩 API가 없음 — 업스트림/계량 없이 깔끔히 거부
  if (provider === "anthropic") {
    return oaiError("Embeddings are not supported for anthropic models", 400, "invalid_request_error", requestId);
  }

  const authz = await authenticateAndAuthorize(req, { provider, model, requestId });
  if (!authz.ok) return authz.response;
  const { apiKey, ids } = authz.ctx;

  // OpenAI 호환 계열: passthrough
  if (OPENAI_COMPATIBLE.includes(provider)) {
    const upstream = await upstreamFetch(
      upstreamUrl(provider, "embeddings"),
      { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders(apiKey) }, body: JSON.stringify(body) },
      { timeoutMs: TIMEOUT_MS, provider, requestId }
    );
    const text = await upstream.text();
    if (upstream.ok) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.usage) await recordUsage({ ...ids, usage: parsed.usage, stream: false });
      } catch {
        /* 비JSON이면 계량 생략 */
      }
    } else {
      logWarn("upstream_error", { requestId, provider, model, status: upstream.status });
    }
    logInfo("request_end", { requestId, provider, model, status: upstream.status, latencyMs: Date.now() - startedAt, stream: false });
    return new NextResponse(text, { status: upstream.status, headers: { "Content-Type": "application/json", "X-Relay-Request-Id": requestId } });
  }

  // Google(Gemini): embedContent(단수)를 입력마다 병렬 호출 후 OpenAI 형식으로 합침
  const inputs = inputsOf(body.input);
  const vectors: number[][] = [];
  for (let i = 0; i < inputs.length; i++) {
    const r = buildEmbedRequest(model, inputs[i], apiKey);
    const upstream = await upstreamFetch(
      r.url,
      { method: "POST", headers: r.headers, body: JSON.stringify(r.body) },
      { timeoutMs: TIMEOUT_MS, provider, requestId }
    );
    if (!upstream.ok) {
      const text = await upstream.text();
      logWarn("upstream_error", { requestId, provider, model, status: upstream.status });
      logInfo("request_end", { requestId, provider, model, status: upstream.status, latencyMs: Date.now() - startedAt, stream: false });
      return new NextResponse(text, { status: upstream.status, headers: { "Content-Type": "application/json", "X-Relay-Request-Id": requestId } });
    }
    vectors.push(valuesFromEmbed(await upstream.json()));
  }
  const openaiResponse = embeddingsResponseToOpenAI(vectors, model);
  await recordUsage({ ...ids, usage: openaiResponse.usage, stream: false });
  logInfo("request_end", { requestId, provider, model, status: 200, latencyMs: Date.now() - startedAt, stream: false });
  return NextResponse.json(openaiResponse, { headers: { "X-Relay-Request-Id": requestId } });
}
