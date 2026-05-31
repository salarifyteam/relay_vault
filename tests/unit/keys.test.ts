import { describe, it, expect } from "vitest";
import { generateApiKey, hashApiKey } from "@/lib/keys";

describe("generateApiKey — 환경 각인 키 형식", () => {
  it("live 키는 rly_live_ 접두사 + prefix/last4가 시크릿과 일치", () => {
    const { secret, prefix, last4 } = generateApiKey("live");
    expect(secret.startsWith("rly_live_")).toBe(true);
    expect(prefix).toBe("rly_live_");
    expect(secret.endsWith(last4)).toBe(true);
    expect(last4).toHaveLength(4);
  });

  it("test 키는 rly_test_ 접두사", () => {
    const { secret, prefix } = generateApiKey("test");
    expect(secret.startsWith("rly_test_")).toBe(true);
    expect(prefix).toBe("rly_test_");
  });

  it("매 호출 고유(연속 100개 시크릿 중복 없음)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generateApiKey("live").secret);
    expect(seen.size).toBe(100);
  });

  it("body 길이 = 48 (접두사 제외)", () => {
    const { secret, prefix } = generateApiKey("live");
    expect(secret.length - prefix.length).toBe(48);
  });
});

describe("hashApiKey — 결정적 SHA-256", () => {
  it("같은 입력 → 같은 해시", () => {
    expect(hashApiKey("rly_live_abc")).toBe(hashApiKey("rly_live_abc"));
  });

  it("다른 입력 → 다른 해시", () => {
    expect(hashApiKey("rly_live_abc")).not.toBe(hashApiKey("rly_live_abd"));
  });

  it("test/live 같은 body라도 접두사가 달라 해시가 다르다", () => {
    // 시크릿 '전체'(접두사 포함)를 해시하므로 환경 혼동이 원천 차단된다.
    expect(hashApiKey("rly_test_SAMEBODY")).not.toBe(hashApiKey("rly_live_SAMEBODY"));
  });

  it("64자 hex", () => {
    expect(hashApiKey("anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});
