import type { ByokProvider } from "@/lib/services/byokProvider";

// OpenAI 호환(동일 형식·Bearer 인증) 프로바이더. anthropic/google은 별도 어댑터가 번역.
export const OPENAI_COMPATIBLE: ByokProvider[] = ["openai", "xai", "zai"];

export type Endpoint = "chat" | "embeddings";

const UPSTREAM: Partial<Record<ByokProvider, { base: string; paths: Record<Endpoint, string> }>> = {
  openai: { base: "https://api.openai.com/v1", paths: { chat: "/chat/completions", embeddings: "/embeddings" } },
  xai: { base: "https://api.x.ai/v1", paths: { chat: "/chat/completions", embeddings: "/embeddings" } },
  zai: { base: "https://api.z.ai/api/paas/v4", paths: { chat: "/chat/completions", embeddings: "/embeddings" } },
};

// 채팅 모델 → 프로바이더 (prefix 매핑)
export function providerFromModel(model: string): ByokProvider | null {
  const m = model.toLowerCase();
  if (m.startsWith("gpt-") || m.startsWith("o1") || m.startsWith("o3")) return "openai";
  if (m.startsWith("claude-")) return "anthropic";
  if (m.startsWith("gemini-")) return "google";
  if (m.startsWith("grok-")) return "xai";
  if (m.startsWith("glm-")) return "zai";
  return null;
}

// 임베딩 모델 → 프로바이더. 채팅과 모델명 체계가 달라 별도 매핑.
// (text-embedding-* = OpenAI, gemini embedding / text-embedding-004 = Google. anthropic은 임베딩 미지원)
export function providerFromEmbeddingModel(model: string): ByokProvider | null {
  const m = model.toLowerCase();
  if (m.startsWith("text-embedding-004") || m.startsWith("gemini-embedding") || m.startsWith("embedding-001")) return "google";
  if (m.startsWith("text-embedding-")) return "openai";
  if (m.startsWith("claude-")) return "anthropic"; // 미지원 안내용으로 식별
  return null;
}

export function upstreamUrl(provider: ByokProvider, endpoint: Endpoint = "chat"): string {
  const u = UPSTREAM[provider];
  if (!u) throw new Error(`No OpenAI-compatible upstream for '${provider}'`);
  return u.base + u.paths[endpoint];
}

export function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}
