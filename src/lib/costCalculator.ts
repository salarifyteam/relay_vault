// USD per 1M tokens (근사값 — 토큰은 정확히 기록, 비용은 추정치). 미등록 모델은 0 폴백.
const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
  // Anthropic
  "claude-3-5-haiku": { input: 0.8, output: 4 },
  "claude-3-5-sonnet": { input: 3, output: 15 },
  "claude-haiku-4": { input: 1, output: 5 },
  "claude-sonnet-4": { input: 3, output: 15 },
  "claude-opus-4": { input: 15, output: 75 },
  // Google Gemini
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  // Embeddings (입력 토큰만, output 0)
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, output: 0 },
  "text-embedding-004": { input: 0, output: 0 }, // Gemini 임베딩(현재 무료)
  "gemini-embedding": { input: 0, output: 0 },
};

// 가장 구체적인(긴) 모델명 prefix 우선 매칭
const KEYS_BY_SPECIFICITY = Object.keys(PRICING).sort(
  (a, b) => b.length - a.length
);

export interface UsageTokens {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

export function normalizeUsage(usage: unknown): UsageTokens {
  const u = (usage || {}) as Record<string, number | undefined>;
  return {
    inputTokens: u.prompt_tokens ?? u.input_tokens ?? 0,
    outputTokens: u.completion_tokens ?? u.output_tokens ?? 0,
    cachedInputTokens:
      (u as { prompt_tokens_details?: { cached_tokens?: number } })
        .prompt_tokens_details?.cached_tokens ?? 0,
  };
}

export function estimateCostUsd(model: string, tokens: UsageTokens): number {
  const key = KEYS_BY_SPECIFICITY.find((k) => model.startsWith(k));
  const p = key ? PRICING[key] : { input: 0, output: 0 };
  return (
    (tokens.inputTokens * p.input + tokens.outputTokens * p.output) / 1_000_000
  );
}
