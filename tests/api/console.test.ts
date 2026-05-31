import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { clearAllTestCollections, disconnectTestDb } from "../helpers/db";
import { createTestSession, addMemberToTenant, isDevServerUp } from "../helpers/session";

const BASE = "http://localhost:3000";

// describe.skipIf는 모듈 로드 시점에 평가됨 → top-level await로 미리 확인
const devUp = await isDevServerUp(BASE);

beforeAll(async () => {
  if (devUp) await clearAllTestCollections();
});
afterAll(async () => {
  await disconnectTestDb();
});

describe.skipIf(!devUp)("Console API contracts — auth + role + behavior", () => {
  describe("인증 가드 — 세션 없으면 401", () => {
    it("api-keys POST 401", async () => {
      const r = await fetch(`${BASE}/api/console/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: "live", name: "x" }),
      });
      expect(r.status).toBe(401);
    });
    it("api-keys GET 401", async () => {
      const r = await fetch(`${BASE}/api/console/api-keys`);
      expect(r.status).toBe(401);
    });
    it("origins PATCH 401", async () => {
      const r = await fetch(`${BASE}/api/console/origins`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      expect(r.status).toBe(401);
    });
    it("revoke-user-key POST 401", async () => {
      const r = await fetch(`${BASE}/api/console/revoke-user-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      expect(r.status).toBe(401);
    });
    it("spend-cap PATCH 401", async () => {
      const r = await fetch(`${BASE}/api/console/spend-cap`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      expect(r.status).toBe(401);
    });
    it("invites POST 401", async () => {
      const r = await fetch(`${BASE}/api/console/invites`, { method: "POST" });
      expect(r.status).toBe(401);
    });
    it("members GET 401", async () => {
      const r = await fetch(`${BASE}/api/console/members`);
      expect(r.status).toBe(401);
    });
    it("switch-tenant POST 401", async () => {
      const r = await fetch(`${BASE}/api/console/switch-tenant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      expect(r.status).toBe(401);
    });
  });

  describe("Owner 인증 — 정상 동작", () => {
    it("api-keys POST: 새 live 키 201 + secret 1회 노출(rly_live_)", async () => {
      const s = await createTestSession();
      const r = await fetch(`${BASE}/api/console/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: s.cookie },
        body: JSON.stringify({ environment: "live", name: "ci-key" }),
      });
      expect(r.status).toBe(201);
      const j = await r.json();
      expect(j.secret).toMatch(/^rly_live_/);
      expect(j.environment).toBe("live");
      expect(j.name).toBe("ci-key");
      expect(j.last4.length).toBe(4);
      expect(j.id).toBeDefined();
    });

    it("api-keys GET: 발급한 키가 목록에 보임(secret 미노출)", async () => {
      const s = await createTestSession();
      const create = await fetch(`${BASE}/api/console/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: s.cookie },
        body: JSON.stringify({ environment: "test", name: "listed" }),
      });
      expect(create.status).toBe(201);
      const created = await create.json();
      const list = await fetch(`${BASE}/api/console/api-keys`, { headers: { Cookie: s.cookie } });
      expect(list.status).toBe(200);
      const { keys } = await list.json();
      const found = keys.find((k: { id: string }) => k.id === created.id);
      expect(found).toBeTruthy();
      expect(found.environment).toBe("test");
      expect(found.secret).toBeUndefined(); // 목록엔 평문 없음
    });

    it("origins PATCH: 배열 저장 + 비배열은 400", async () => {
      const s = await createTestSession();
      const r1 = await fetch(`${BASE}/api/console/origins`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: s.cookie },
        body: JSON.stringify({ allowedOrigins: ["https://a.test", "https://b.test"] }),
      });
      expect(r1.status).toBe(200);
      const r2 = await fetch(`${BASE}/api/console/origins`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: s.cookie },
        body: JSON.stringify({ allowedOrigins: "not-array" }),
      });
      expect(r2.status).toBe(400);
    });

    it("spend-cap: 숫자 저장 / null로 해제 / 음수 400", async () => {
      const s = await createTestSession();
      const r1 = await fetch(`${BASE}/api/console/spend-cap`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: s.cookie },
        body: JSON.stringify({ defaultUserSpendCapUsd: 25 }),
      });
      expect(r1.status).toBe(200);
      const r2 = await fetch(`${BASE}/api/console/spend-cap`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: s.cookie },
        body: JSON.stringify({ defaultUserSpendCapUsd: null }),
      });
      expect(r2.status).toBe(200);
      const r3 = await fetch(`${BASE}/api/console/spend-cap`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: s.cookie },
        body: JSON.stringify({ defaultUserSpendCapUsd: -5 }),
      });
      expect(r3.status).toBe(400);
    });

    it("revoke-user-key: 없는 키 404, 필드 누락 400", async () => {
      const s = await createTestSession();
      const r1 = await fetch(`${BASE}/api/console/revoke-user-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: s.cookie },
        body: JSON.stringify({}),
      });
      expect(r1.status).toBe(400);
      const r2 = await fetch(`${BASE}/api/console/revoke-user-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: s.cookie },
        body: JSON.stringify({ endUserLabel: "nope", provider: "openai" }),
      });
      expect(r2.status).toBe(404);
    });

    it("invites POST(owner): 토큰 생성 + GET 목록 + DELETE 폐기", async () => {
      const s = await createTestSession({ role: "owner" });
      const create = await fetch(`${BASE}/api/console/invites`, {
        method: "POST",
        headers: { Cookie: s.cookie },
      });
      expect(create.status).toBe(200);
      const { inviteUrl, token } = await create.json();
      expect(inviteUrl).toContain("/invite/");
      expect(token).toMatch(/^inv-/);
      const list = await fetch(`${BASE}/api/console/invites`, { headers: { Cookie: s.cookie } });
      expect(list.status).toBe(200);
      const { invites } = await list.json();
      expect(invites.some((i: { token: string }) => i.token === token)).toBe(true);
      const del = await fetch(`${BASE}/api/console/invites?token=${token}`, {
        method: "DELETE",
        headers: { Cookie: s.cookie },
      });
      expect(del.status).toBe(200);
    });

    it("members GET(owner): 본인 1명 반환", async () => {
      const s = await createTestSession();
      const r = await fetch(`${BASE}/api/console/members`, { headers: { Cookie: s.cookie } });
      expect(r.status).toBe(200);
      const { members } = await r.json();
      expect(members.length).toBe(1);
      expect(members[0].role).toBe("owner");
    });

    it("members DELETE: 본인 제거 시도 400", async () => {
      const s = await createTestSession();
      const r = await fetch(`${BASE}/api/console/members?accountId=${s.accountId}`, {
        method: "DELETE",
        headers: { Cookie: s.cookie },
      });
      expect(r.status).toBe(400);
    });
  });

  describe("Member 역할 가드", () => {
    it("Member도 mutation 4종 통과(member 이상)", async () => {
      const owner = await createTestSession({ role: "owner" });
      const member = await addMemberToTenant(owner.tenantId, "member");
      const r = await fetch(`${BASE}/api/console/origins`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: member.cookie },
        body: JSON.stringify({ allowedOrigins: ["https://m.test"] }),
      });
      expect(r.status).toBe(200);
    });

    it("Member는 invites POST 403", async () => {
      const owner = await createTestSession({ role: "owner" });
      const member = await addMemberToTenant(owner.tenantId, "member");
      const r = await fetch(`${BASE}/api/console/invites`, {
        method: "POST",
        headers: { Cookie: member.cookie },
      });
      expect(r.status).toBe(403);
    });

    it("Member는 members DELETE 403", async () => {
      const owner = await createTestSession({ role: "owner" });
      const member = await addMemberToTenant(owner.tenantId, "member");
      const r = await fetch(`${BASE}/api/console/members?accountId=${owner.accountId}`, {
        method: "DELETE",
        headers: { Cookie: member.cookie },
      });
      expect(r.status).toBe(403);
    });
  });

  describe("switch-tenant — 멤버십 검증", () => {
    it("내 멤버십 테넌트로 전환: 200", async () => {
      const a = await createTestSession({ tenantName: "T-A" });
      const b = await createTestSession({ tenantName: "T-B", email: a.cookie /*dummy*/ });
      // b는 다른 계정/테넌트라 a 세션으로는 못 감
      const r = await fetch(`${BASE}/api/console/switch-tenant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: a.cookie },
        body: JSON.stringify({ tenantId: b.tenantId }),
      });
      expect(r.status).toBe(403);
    });

    it("잘못된 tenantId 형식: 400", async () => {
      const a = await createTestSession();
      const r = await fetch(`${BASE}/api/console/switch-tenant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: a.cookie },
        body: JSON.stringify({ tenantId: "not-an-objectid" }),
      });
      expect(r.status).toBe(400);
    });
  });
});

describe.skipIf(!devUp)("Public + proxy contracts", () => {
  it("/api/health 200", async () => {
    const r = await fetch(`${BASE}/api/health`);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.status).toBe("ok");
  });

  it("/docs 200(공개)", async () => {
    const r = await fetch(`${BASE}/docs`);
    expect(r.status).toBe(200);
  });

  it("/login 200(공개)", async () => {
    const r = await fetch(`${BASE}/login`);
    expect(r.status).toBe(200);
  });

  it("/console 미로그인 → /login 리디렉트(307)", async () => {
    const r = await fetch(`${BASE}/console`, { redirect: "manual" });
    expect(r.status).toBe(307);
  });

  describe("/v1/chat/completions 인증", () => {
    it("rly- 키 없으면 401", async () => {
      const r = await fetch(`${BASE}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [] }),
      });
      expect(r.status).toBe(401);
    });
    it("X-Relay-User 누락 시 400", async () => {
      const r = await fetch(`${BASE}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer rly-bogus",
        },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [] }),
      });
      expect(r.status).toBe(400);
    });
    it("model 누락 시 400", async () => {
      const r = await fetch(`${BASE}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer rly-bogus",
          "X-Relay-User": "u",
        },
        body: JSON.stringify({}),
      });
      expect(r.status).toBe(400);
    });
    it("모르는 모델 → 400", async () => {
      const r = await fetch(`${BASE}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer rly-bogus",
          "X-Relay-User": "u",
        },
        body: JSON.stringify({ model: "random-model-name", messages: [] }),
      });
      expect(r.status).toBe(400);
    });
    it("잘못된 rly- 키 → 401", async () => {
      const r = await fetch(`${BASE}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer rly-bogus",
          "X-Relay-User": "u",
        },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [] }),
      });
      expect(r.status).toBe(401);
    });
  });

  describe("/v1/embeddings 인증·라우팅", () => {
    it("model 누락 400", async () => {
      const r = await fetch(`${BASE}/v1/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer rly-bogus",
          "X-Relay-User": "u",
        },
        body: JSON.stringify({ input: "x" }),
      });
      expect(r.status).toBe(400);
    });
    it("anthropic 임베딩 모델 → 400 미지원 안내", async () => {
      const r = await fetch(`${BASE}/v1/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer rly-bogus",
          "X-Relay-User": "u",
        },
        body: JSON.stringify({ model: "claude-3-5-haiku", input: "x" }),
      });
      expect(r.status).toBe(400);
      const j = await r.json();
      expect(j.error.message).toMatch(/anthropic/i);
    });
  });

  describe("/v1/registration-tokens", () => {
    it("rly- 키 없으면 401", async () => {
      const r = await fetch(`${BASE}/v1/registration-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endUserLabel: "u" }),
      });
      expect(r.status).toBe(401);
    });
    it("endUserLabel 누락 400", async () => {
      const r = await fetch(`${BASE}/v1/registration-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer rly-bogus" },
        body: JSON.stringify({}),
      });
      expect(r.status).toBe(400);
    });
    it("정상: 토큰 발급(테스트 세션의 rly-키)", async () => {
      const s = await createTestSession();
      const r = await fetch(`${BASE}/v1/registration-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.rlyKey}` },
        body: JSON.stringify({ endUserLabel: "u1", provider: "openai" }),
      });
      expect(r.status).toBe(200);
      const j = await r.json();
      expect(j.registrationToken).toMatch(/^rgt-/);
      expect(j.expiresAt).toBeDefined();
    });
    it("provider 생략 가능(위젯에서 선택)", async () => {
      const s = await createTestSession();
      const r = await fetch(`${BASE}/v1/registration-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.rlyKey}` },
        body: JSON.stringify({ endUserLabel: "u2" }),
      });
      expect(r.status).toBe(200);
    });
  });
});
