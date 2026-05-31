import { describe, it, expect } from "vitest";
import {
  providerFromModel,
  providerFromEmbeddingModel,
  upstreamUrl,
  OPENAI_COMPATIBLE,
} from "@/lib/providerRouting";

describe("providerFromModel (chat) — prefix 매핑", () => {
  it("gpt-* → openai", () => {
    expect(providerFromModel("gpt-4o-mini")).toBe("openai");
    expect(providerFromModel("gpt-4.1")).toBe("openai");
  });

  it("o1, o3 → openai", () => {
    expect(providerFromModel("o1")).toBe("openai");
    expect(providerFromModel("o3-mini")).toBe("openai");
  });

  it("claude-* → anthropic", () => {
    expect(providerFromModel("claude-3-5-haiku")).toBe("anthropic");
    expect(providerFromModel("claude-haiku-4-5")).toBe("anthropic");
  });

  it("gemini-* → google", () => {
    expect(providerFromModel("gemini-2.5-flash")).toBe("google");
  });

  it("grok-* → xai, glm-* → zai", () => {
    expect(providerFromModel("grok-beta")).toBe("xai");
    expect(providerFromModel("glm-4")).toBe("zai");
  });

  it("대소문자 무시", () => {
    expect(providerFromModel("GPT-4o")).toBe("openai");
    expect(providerFromModel("Claude-3")).toBe("anthropic");
  });

  it("모르는 모델 → null", () => {
    expect(providerFromModel("random-model")).toBeNull();
    expect(providerFromModel("")).toBeNull();
  });

  it("임베딩 모델은 chat 매핑에서 잡히면 안 됨(text-embedding-*는 모름)", () => {
    // text-embedding-* 는 chat 라우트엔 null이 적절
    expect(providerFromModel("text-embedding-3-small")).toBeNull();
  });
});

describe("providerFromEmbeddingModel — 임베딩 전용", () => {
  it("text-embedding-3-small/large → openai", () => {
    expect(providerFromEmbeddingModel("text-embedding-3-small")).toBe("openai");
    expect(providerFromEmbeddingModel("text-embedding-3-large")).toBe("openai");
  });

  it("text-embedding-004, gemini-embedding-001 → google", () => {
    expect(providerFromEmbeddingModel("text-embedding-004")).toBe("google");
    expect(providerFromEmbeddingModel("gemini-embedding-001")).toBe("google");
    expect(providerFromEmbeddingModel("embedding-001")).toBe("google");
  });

  it("claude-* → anthropic(미지원 안내용 식별)", () => {
    expect(providerFromEmbeddingModel("claude-3-5-haiku")).toBe("anthropic");
  });

  it("모르는 모델 → null", () => {
    expect(providerFromEmbeddingModel("random")).toBeNull();
    expect(providerFromEmbeddingModel("")).toBeNull();
  });
});

describe("upstreamUrl — base + path", () => {
  it("기본값 chat (기존 호환)", () => {
    expect(upstreamUrl("openai")).toBe("https://api.openai.com/v1/chat/completions");
    expect(upstreamUrl("xai")).toBe("https://api.x.ai/v1/chat/completions");
    expect(upstreamUrl("zai")).toBe("https://api.z.ai/api/paas/v4/chat/completions");
  });

  it("embeddings 엔드포인트", () => {
    expect(upstreamUrl("openai", "embeddings")).toBe("https://api.openai.com/v1/embeddings");
    expect(upstreamUrl("xai", "embeddings")).toBe("https://api.x.ai/v1/embeddings");
  });

  it("anthropic/google은 호환 unsupported → throw (어댑터 사용)", () => {
    expect(() => upstreamUrl("anthropic")).toThrow();
    expect(() => upstreamUrl("google")).toThrow();
  });

  it("OPENAI_COMPATIBLE 목록 무결성", () => {
    expect(OPENAI_COMPATIBLE).toContain("openai");
    expect(OPENAI_COMPATIBLE).toContain("xai");
    expect(OPENAI_COMPATIBLE).toContain("zai");
    expect(OPENAI_COMPATIBLE).not.toContain("anthropic");
    expect(OPENAI_COMPATIBLE).not.toContain("google");
  });
});
