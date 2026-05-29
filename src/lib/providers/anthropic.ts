import {
  OAIRequest,
  ProviderAdapter,
  OpenAIResponse,
  extractTextContent,
} from "./shared";

const ANTHROPIC_VERSION = "2023-06-01";

function mapStopReason(reason: string | null | undefined): string {
  if (reason === "end_turn" || reason === "stop_sequence") return "stop";
  if (reason === "max_tokens") return "length";
  return reason || "stop";
}

export const anthropicAdapter: ProviderAdapter = {
  buildRequest(body: OAIRequest, apiKey: string, isStream: boolean) {
    // system은 Anthropic에서 최상위 필드 (메시지 아님)
    const system = body.messages
      .filter((m) => m.role === "system")
      .map((m) => extractTextContent(m.content))
      .join("\n");
    const messages = body.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: extractTextContent(m.content) }));

    const anthropicBody: Record<string, unknown> = {
      model: body.model,
      max_tokens: body.max_tokens ?? 4096, // Anthropic 필수
      messages,
      stream: isStream,
    };
    if (system) anthropicBody.system = system;
    if (typeof body.temperature === "number")
      anthropicBody.temperature = body.temperature;
    if (body.stop)
      anthropicBody.stop_sequences = Array.isArray(body.stop)
        ? body.stop
        : [body.stop];

    return {
      url: "https://api.anthropic.com/v1/messages",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: anthropicBody,
    };
  },

  responseToOpenAI(data: unknown, model: string): OpenAIResponse {
    const d = (data || {}) as {
      id?: string;
      content?: Array<{ type?: string; text?: string }>;
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (d.content || [])
      .filter((b) => b?.type === "text")
      .map((b) => b.text || "")
      .join("");
    const input = d.usage?.input_tokens || 0;
    const output = d.usage?.output_tokens || 0;
    return {
      id: d.id || `relay_${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: text },
          finish_reason: mapStopReason(d.stop_reason),
        },
      ],
      usage: {
        prompt_tokens: input,
        completion_tokens: output,
        total_tokens: input + output,
      },
    };
  },

  streamToOpenAI(upstream, model, onUsage) {
    const reader = upstream.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";
    const id = `relay_${Date.now()}`;
    let inputTokens = 0;
    let outputTokens = 0;

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
          if (inputTokens || outputTokens) {
            try {
              await onUsage({
                prompt_tokens: inputTokens,
                completion_tokens: outputTokens,
              });
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
            type?: string;
            delta?: { text?: string; stop_reason?: string };
            content_block?: { text?: string };
            message?: { usage?: { input_tokens?: number; output_tokens?: number } };
            usage?: { input_tokens?: number; output_tokens?: number };
          };
          try {
            ev = JSON.parse(payload);
          } catch {
            continue;
          }
          if (ev.type === "content_block_delta") {
            const t = ev.delta?.text || "";
            if (t) emit(controller, chunk({ content: t }));
          } else if (ev.type === "content_block_start") {
            const t = ev.content_block?.text || "";
            if (t) emit(controller, chunk({ content: t }));
          } else if (ev.type === "message_start") {
            inputTokens = ev.message?.usage?.input_tokens || inputTokens;
            outputTokens = ev.message?.usage?.output_tokens || outputTokens;
          } else if (ev.type === "message_delta") {
            if (ev.usage?.output_tokens != null)
              outputTokens = ev.usage.output_tokens;
            if (ev.delta?.stop_reason)
              emit(controller, chunk({}, mapStopReason(ev.delta.stop_reason)));
          }
        }
      },
      cancel() {
        reader.cancel();
      },
    });
  },
};
