import { describe, it, expect } from "vitest";
import { normalizeUsage, estimateCostUsd } from "@/lib/costCalculator";

describe("normalizeUsage — provider별 usage 정규화", () => {
  it("OpenAI 형식: prompt_tokens / completion_tokens", () => {
    const u = normalizeUsage({ prompt_tokens: 100, completion_tokens: 50 });
    expect(u.inputTokens).toBe(100);
    expect(u.outputTokens).toBe(50);
    expect(u.cachedInputTokens).toBe(0);
  });

  it("Anthropic 스타일: input_tokens / output_tokens", () => {
    const u = normalizeUsage({ input_tokens: 200, output_tokens: 75 });
    expect(u.inputTokens).toBe(200);
    expect(u.outputTokens).toBe(75);
  });

  it("OpenAI prompt_tokens_details.cached_tokens 인식", () => {
    const u = normalizeUsage({
      prompt_tokens: 1000,
      completion_tokens: 100,
      prompt_tokens_details: { cached_tokens: 800 },
    });
    expect(u.cachedInputTokens).toBe(800);
  });

  it("임베딩(입력만): output 0 안전 처리", () => {
    const u = normalizeUsage({ prompt_tokens: 50, total_tokens: 50 });
    expect(u.inputTokens).toBe(50);
    expect(u.outputTokens).toBe(0);
  });

  it("null/undefined 안전", () => {
    expect(normalizeUsage(null)).toEqual({ inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 });
    expect(normalizeUsage(undefined)).toEqual({ inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 });
    expect(normalizeUsage({})).toEqual({ inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 });
  });
});

describe("estimateCostUsd — 모델별 단가 USD/1M", () => {
  it("gpt-4o-mini 1000/500 토큰 = (1000*0.15 + 500*0.6)/1M", () => {
    const cost = estimateCostUsd("gpt-4o-mini", { inputTokens: 1000, outputTokens: 500, cachedInputTokens: 0 });
    expect(cost).toBeCloseTo((1000 * 0.15 + 500 * 0.6) / 1_000_000, 10);
  });

  it("longest-prefix 정확성: claude-3-5-sonnet은 claude-3-5-haiku 단가와 다름", () => {
    const sonnet = estimateCostUsd("claude-3-5-sonnet", { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 0 });
    const haiku = estimateCostUsd("claude-3-5-haiku", { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 0 });
    expect(sonnet).toBe(3); // 3 USD per 1M input
    expect(haiku).toBe(0.8);
  });

  it("text-embedding-3-small은 입력 단가만(output 0)", () => {
    const cost = estimateCostUsd("text-embedding-3-small", { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 0 });
    expect(cost).toBe(0.02);
  });

  it("text-embedding-3-large 단가 ≠ small (longest-prefix가 small을 안 잡음)", () => {
    const large = estimateCostUsd("text-embedding-3-large", { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 0 });
    expect(large).toBe(0.13);
  });

  it("Gemini 임베딩은 무료(0)", () => {
    expect(estimateCostUsd("text-embedding-004", { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 0 })).toBe(0);
    expect(estimateCostUsd("gemini-embedding-001", { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 0 })).toBe(0);
  });

  it("모르는 모델 → 0 폴백", () => {
    const cost = estimateCostUsd("totally-unknown-model", { inputTokens: 9999, outputTokens: 9999, cachedInputTokens: 0 });
    expect(cost).toBe(0);
  });

  it("0 토큰 → 0", () => {
    expect(estimateCostUsd("gpt-4o", { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 })).toBe(0);
  });
});
