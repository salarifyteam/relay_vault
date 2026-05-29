// Gemini 임베딩 어댑터. 채팅용 ProviderAdapter와 별개 — 임베딩은 요청/응답 형식이 다르다.
// Gemini는 embedContent(단수)만 지원(입력 1개). OpenAI는 배열 입력을 받으므로 각 입력을
// 병렬 embedContent로 호출한 뒤 OpenAI embeddings 형식으로 합친다.
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export interface OAIEmbeddingsRequest {
  model: string;
  input: string | string[];
}

// 입력 하나에 대한 Gemini embedContent 요청 파라미터
export function buildEmbedRequest(model: string, text: string, apiKey: string) {
  return {
    url: `${BASE}/${model}:embedContent`,
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: { content: { parts: [{ text }] } },
  };
}

export function inputsOf(input: string | string[]): string[] {
  return Array.isArray(input) ? input : [input];
}

// embedContent 응답 1건 → values 추출
export function valuesFromEmbed(data: unknown): number[] {
  const d = (data || {}) as { embedding?: { values?: number[] } };
  return d.embedding?.values || [];
}

// 여러 입력의 values 배열 → OpenAI embeddings 형식
export function embeddingsResponseToOpenAI(vectors: number[][], model: string) {
  return {
    object: "list",
    data: vectors.map((embedding, index) => ({ object: "embedding", index, embedding })),
    model,
    usage: { prompt_tokens: 0, total_tokens: 0 }, // Gemini는 임베딩 토큰 수 미반환
  };
}
