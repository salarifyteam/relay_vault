import { describe, it, expect } from "vitest";
import { createTestSession, isDevServerUp } from "../helpers/session";
// SDK는 빌드된 dist를 직접 import(외부 npm 설치 우회)
import { Relay, RelayError } from "../../packages/sdk/dist/index.js";

const BASE = "http://localhost:3000";
const devUp = await isDevServerUp(BASE);

describe.skipIf(!devUp)("@relayservice/sdk — 로컬 dev 서버 대상", () => {
  it("health() → status: ok", async () => {
    const r = new Relay({ key: "rly-not-needed-for-health", baseURL: BASE });
    const h = await r.health();
    expect(h.status).toBe("ok");
  });

  it("createRegistrationToken — 유효 키로 토큰 발급", async () => {
    const s = await createTestSession();
    const relay = new Relay({ key: s.rlyKey, baseURL: BASE });
    const t = await relay.createRegistrationToken({ user: "sdk_test", provider: "openai" });
    expect(t.registrationToken).toMatch(/^rgt-/);
    expect(t.expiresAt).toBeDefined();
    expect(t.submitUrl).toContain("/api/widget/keys");
  });

  it("createRegistrationToken — 잘못된 키 → RelayError(401)", async () => {
    const relay = new Relay({ key: "rly-bogus-totally", baseURL: BASE });
    try {
      await relay.createRegistrationToken({ user: "x" });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(RelayError);
      expect((e as RelayError).status).toBe(401);
    }
  });

  it("relay.openai({user}) → 사전설정된 OpenAI 인스턴스 반환", async () => {
    const s = await createTestSession();
    const relay = new Relay({ key: s.rlyKey, baseURL: BASE });
    const ai = relay.openai({ user: "sdk_test_user" });
    expect(ai).toBeDefined();
    expect(ai.chat).toBeDefined();
    expect(ai.chat.completions).toBeDefined();
    expect(ai.embeddings).toBeDefined();
  });

  it("constructor: key 누락 → throw", () => {
    expect(() => new Relay({ key: "" })).toThrow();
  });
});
