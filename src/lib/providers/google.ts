import {
  OAIRequest,
  ProviderAdapter,
  OpenAIResponse,
  extractTextContent,
} from "./shared";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function mapFinishReason(reason: string | null | undefined): string {
  if (reason === "MAX_TOKENS") return "length";
  if (reason === "STOP") return "stop";
  return reason ? reason.toLowerCase() : "stop";
}

type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

function usageToOpenAI(u: GeminiUsage | undefined) {
  const prompt = u?.promptTokenCount || 0;
  const completion = u?.candidatesTokenCount || 0;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: u?.totalTokenCount || prompt + completion,
  };
}

export const googleAdapter: ProviderAdapter = {
  buildRequest(body: OAIRequest, apiKey: string, isStream: boolean) {
    const systemText = body.messages
      .filter((m) => m.role === "system")
      .map((m) => extractTextContent(m.content))
      .join("\n");
    const contents = body.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: extractTextContent(m.content) }],
      }));

    const generationConfig: Record<string, number> = {};
    if (typeof body.temperature === "number")
      generationConfig.temperature = body.temperature;
    if (typeof body.max_tokens === "number")
      generationConfig.maxOutputTokens = body.max_tokens;

    const geminiBody: Record<string, unknown> = { contents };
    if (systemText)
      geminiBody.systemInstruction = { parts: [{ text: systemText }] };
    if (Object.keys(generationConfig).length > 0)
      geminiBody.generationConfig = generationConfig;

    const method = isStream
      ? "streamGenerateContent?alt=sse"
      : "generateContent";
    return {
      url: `${BASE}/${body.model}:${method}`,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: geminiBody,
    };
  },

  responseToOpenAI(data: unknown, model: string): OpenAIResponse {
    const d = (data || {}) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      usageMetadata?: GeminiUsage;
    };
    const candidate = d.candidates?.[0];
    const text = (candidate?.content?.parts || [])
      .map((p) => p.text || "")
      .join("");
    return {
      id: `relay_${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: text },
          finish_reason: mapFinishReason(candidate?.finishReason),
        },
      ],
      usage: usageToOpenAI(d.usageMetadata),
    };
  },

  streamToOpenAI(upstream, model, onUsage) {
    const reader = upstream.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";
    const id = `relay_${Date.now()}`;
    let usage: GeminiUsage | undefined;

    const chunk = (delta: object, finish: string | null = null) => ({
      id,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, delta, finish_reason: finish }],
    });
    const emit = (
      controller: ReadableStreamDefaultController<Uint8Array>,
      obj: object
    ) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          if (usage) {
            try {
              await onUsage(usageToOpenAI(usage));
            } catch {
              /* 계량 실패는 응답을 막지 않음 */
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let ev: {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> };
              finishReason?: string;
            }>;
            usageMetadata?: GeminiUsage;
          };
          try {
            ev = JSON.parse(payload);
          } catch {
            continue;
          }
          const candidate = ev.candidates?.[0];
          const text = (candidate?.content?.parts || [])
            .map((p) => p.text || "")
            .join("");
          if (text) emit(controller, chunk({ content: text }));
          if (candidate?.finishReason)
            emit(controller, chunk({}, mapFinishReason(candidate.finishReason)));
          if (ev.usageMetadata) usage = ev.usageMetadata;
        }
      },
      cancel() {
        reader.cancel();
      },
    });
  },
};
