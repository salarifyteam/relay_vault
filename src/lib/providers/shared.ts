export interface OAIMessage {
  role: string;
  content: unknown;
}

export interface OAIRequest {
  model: string;
  messages: OAIMessage[];
  max_tokens?: number;
  temperature?: number;
  stop?: string | string[];
  stream?: boolean;
}

export interface UpstreamRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface OpenAIResponse {
  id: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  [k: string]: unknown;
}

// OpenAI 형식으로 다른 프로바이더를 감싸는 번역 어댑터
export interface ProviderAdapter {
  buildRequest(body: OAIRequest, apiKey: string, isStream: boolean): UpstreamRequest;
  responseToOpenAI(data: unknown, model: string): OpenAIResponse;
  streamToOpenAI(
    upstream: ReadableStream<Uint8Array>,
    model: string,
    onUsage: (usage: unknown) => Promise<void>
  ): ReadableStream<Uint8Array>;
}

// 프로바이더 네이티브 에러를 OpenAI 에러 형식으로 정규화
// (개발자의 기존 OpenAI 클라이언트 에러 처리가 그대로 동작하도록)
export function toOpenAIError(
  provider: string,
  rawText: string
): { error: { message: string; type: string; code: string | null } } {
  let message = rawText;
  let type = "upstream_error";
  let code: string | null = null;
  try {
    const j = JSON.parse(rawText) as {
      error?: { message?: string; type?: string; status?: string; code?: string | number };
      message?: string;
    };
    if (j.error && typeof j.error === "object") {
      message = j.error.message || message;
      type = j.error.type || j.error.status || type;
      code = j.error.code != null ? String(j.error.code) : null;
    } else if (typeof j.message === "string") {
      message = j.message;
    }
  } catch {
    /* 비JSON 에러 바디는 원문 메시지 그대로 */
  }
  return { error: { message, type: `${provider}:${type}`, code } };
}

// OpenAI content는 문자열 또는 [{type:'text', text}] 배열일 수 있음 (텍스트만 추출)
export function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) =>
        p && typeof p === "object" && "text" in p
          ? String((p as { text?: unknown }).text ?? "")
          : ""
      )
      .join("");
  }
  return content == null ? "" : String(content);
}
