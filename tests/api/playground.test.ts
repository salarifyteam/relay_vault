import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { clearAllTestCollections, disconnectTestDb } from "../helpers/db";
import { createTestSession, isDevServerUp } from "../helpers/session";

const BASE = "http://localhost:3000";
const devUp = await isDevServerUp(BASE);

beforeAll(async () => {
  if (devUp) await clearAllTestCollections();
});
afterAll(async () => {
  await disconnectTestDb();
});

// 인증 가드는 서버만 있으면 검증 가능(세션 무관).
describe.skipIf(!devUp)("Playground 프록시 — 인증 가드", () => {
  it("세션 없으면 401", async () => {
    const r = await fetch(`${BASE}/api/console/playground`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "chat", endUserLabel: "x", body: {} }),
    });
    expect(r.status).toBe(401);
  });

  it("알 수 없는 endpoint → 400", async () => {
    const s = await createTestSession();
    const r = await fetch(`${BASE}/api/console/playground`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: s.cookie },
      body: JSON.stringify({ endpoint: "nope" }),
    });
    expect(r.status).toBe(400);
  });
});

describe.skipIf(!devUp)("Playground 프록시 — verbatim 전달 + test 키 처리", () => {
  it("registration-token: 토큰 발급 성공(test 키가 내부적으로 mint되어 호출됨)", async () => {
    const s = await createTestSession();
    const r = await fetch(`${BASE}/api/console/playground`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: s.cookie },
      body: JSON.stringify({ endpoint: "registration-token", endUserLabel: "alice", provider: "openai" }),
    });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.registrationToken).toMatch(/^rgt-/);
  });

  it("★ chat without a BYOK key → enduser_key_missing(404)이 code 그대로 전달된다", async () => {
    const s = await createTestSession();
    const r = await fetch(`${BASE}/api/console/playground`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: s.cookie },
      body: JSON.stringify({
        endpoint: "chat",
        endUserLabel: "nobody",
        body: { model: "gpt-4o-mini", messages: [{ role: "user", content: "hi" }] },
      }),
    });
    // 프록시가 v1의 404 + error.code를 그대로 흘려보낸다(verbatim).
    expect(r.status).toBe(404);
    const j = await r.json();
    expect(j.error.code).toBe("enduser_key_missing");
  });

  it("playground가 발급한 test 키는 호출 후 폐기되어 누적되지 않는다", async () => {
    const s = await createTestSession();
    // registration-token을 2회 호출
    for (let i = 0; i < 2; i++) {
      await fetch(`${BASE}/api/console/playground`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: s.cookie },
        body: JSON.stringify({ endpoint: "registration-token", endUserLabel: "a" }),
      });
    }
    // 활성 playground 키는 0개여야 한다(각 호출이 finally에서 폐기).
    // DB 직접 조회로 확인.
    const { default: ApiKey } = await import("@/lib/models/ApiKey");
    const active = await ApiKey.countDocuments({
      tenantId: s.tenantId,
      name: "playground",
      status: "active",
    });
    expect(active).toBe(0);
  });
});
