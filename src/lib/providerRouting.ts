import type { ByokProvider } from "@/lib/services/byokProvider";

// OpenAI 호환(동일 형식·Bearer 인증) 프로바이더. anthropic/google은 별도 어댑터가 번역.
export const OPENAI_COMPATIBLE: ByokProvider[] = ["openai", "xai", "zai"];

const UPSTREAM: Partial<Record<ByokProvider, string>> = {
  openai: "https://api.openai.com/v1/chat/completions",
  xai: "https://api.x.ai/v1/chat/completions",
  zai: "https://api.z.ai/api/paas/v4/chat/completions",
};

export function providerFromModel(model: string): ByokProvider | null {
  const m = model.toLowerCase();
  if (m.startsWith("gpt-") || m.startsWith("o1") || m.startsWith("o3")) return "openai";
  if (m.startsWith("claude-")) return "anthropic";
  if (m.startsWith("gemini-")) return "google";
  if (m.startsWith("grok-")) return "xai";
  if (m.startsWith("glm-")) return "zai";
  return null;
}

export function upstreamUrl(provider: ByokProvider): string {
  const url = UPSTREAM[provider];
  if (!url) throw new Error(`No OpenAI-compatible upstream for '${provider}'`);
  return url;
}

export function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}
