import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import Tenant from "@/lib/models/Tenant";
import ApiKey from "@/lib/models/ApiKey";
import EndUserKey from "@/lib/models/EndUserKey";
import RateCounter from "@/lib/models/RateCounter";
import UsageRecord from "@/lib/models/UsageRecord";
import { authenticateAndAuthorize } from "@/lib/proxyCommon";
import { mintApiKey } from "@/lib/services/apiKeyService";
import { getCrypto } from "@/lib/crypto";
import type { Environment } from "@/lib/keys";
import { clearAllTestCollections, disconnectTestDb } from "../helpers/db";

let tenantId: mongoose.Types.ObjectId;
let liveSecret: string;

beforeAll(async () => {
  await clearAllTestCollections();
  await EndUserKey.syncIndexes();
  await RateCounter.syncIndexes();
  const t = await Tenant.create({ name: "Err", plan: "growth" });
  tenantId = t._id as mongoose.Types.ObjectId;
  liveSecret = (await mintApiKey({ tenantId: String(tenantId), environment: "live", name: "k" })).secret;
});

beforeEach(async () => {
  await EndUserKey.deleteMany({});
  await RateCounter.deleteMany({});
});

afterAll(async () => {
  await disconnectTestDb();
});

async function makeLiveEndUserKey(label = "alice") {
  const sealed = await getCrypto().seal("sk-dummy", { tenantId: String(tenantId) });
  return EndUserKey.create({
    tenantId, environment: "live" as Environment, endUserLabel: label, provider: "openai",
    keyEncrypted: sealed.ciphertext, keyMasked: "sk-...xx", cryptoVersion: sealed.cryptoVersion,
    wrappedDataKey: sealed.wrappedDataKey, validationState: "valid", isActive: true, isPaid: true,
  });
}

function req(secret: string, user = "alice", extraHeaders: Record<string, string> = {}) {
  return new NextRequest("https://relay.test/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "x-relay-user": user, "content-type": "application/json", ...extraHeaders },
  });
}
const P = { provider: "openai" as const, model: "gpt-4o-mini", requestId: "req-test" };

// authenticateAndAuthorize의 실패 응답에서 error.code를 꺼낸다.
async function codeOf(res: { ok: boolean; response?: Response }): Promise<string | undefined> {
  if (res.ok || !res.response) return undefined;
  return (await res.response.json()).error?.code;
}

describe("v1 에러 코드 — 인증 실패별 distinct code", () => {
  it("키 형식 오류 → relay_key_invalid (401)", async () => {
    const res = await authenticateAndAuthorize(req("not-a-relay-key"), P);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.response.status).toBe(401);
      expect(await codeOf(res)).toBe("relay_key_invalid");
    }
  });

  it("알 수 없는/폐기된 키 → relay_key_revoked (401)", async () => {
    const res = await authenticateAndAuthorize(req("rly_live_doesnotexist"), P);
    expect(await codeOf(res)).toBe("relay_key_revoked");
  });

  it("테넌트 비활성 → relay_tenant_disabled (401)", async () => {
    // 비활성 테넌트 + 그 키
    const dt = await Tenant.create({ name: "Disabled", plan: "growth", status: "disabled" });
    const s = (await mintApiKey({ tenantId: String(dt._id), environment: "live", name: "k" })).secret;
    const res = await authenticateAndAuthorize(req(s), P);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(401);
    expect(await codeOf(res)).toBe("relay_tenant_disabled");
  });

  it("X-Relay-User 누락 → user_header_missing (400)", async () => {
    const r = new NextRequest("https://relay.test/x", {
      method: "POST",
      headers: { authorization: `Bearer ${liveSecret}`, "content-type": "application/json" },
    });
    const res = await authenticateAndAuthorize(r, P);
    expect(await codeOf(res)).toBe("user_header_missing");
  });

  it("엔드유저 키 없음 → enduser_key_missing (404)", async () => {
    // live EndUserKey 미생성 상태
    const res = await authenticateAndAuthorize(req(liveSecret), P);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(404);
    expect(await codeOf(res)).toBe("enduser_key_missing");
  });

  it("★ 예전엔 구분 불가했던 401 3종이 이제 서로 다른 code다", async () => {
    const c1 = await codeOf(await authenticateAndAuthorize(req("bad"), P));
    const c2 = await codeOf(await authenticateAndAuthorize(req("rly_live_nope"), P));
    const dt = await Tenant.create({ name: "D2", plan: "growth", status: "disabled" });
    const s = (await mintApiKey({ tenantId: String(dt._id), environment: "live", name: "k" })).secret;
    const c3 = await codeOf(await authenticateAndAuthorize(req(s), P));
    expect(new Set([c1, c2, c3]).size).toBe(3); // 모두 다름
    expect([c1, c2, c3]).toEqual(["relay_key_invalid", "relay_key_revoked", "relay_tenant_disabled"]);
  });
});

describe("v1 에러 코드 — 한도", () => {
  it("스펜드 캡 도달 → spend_cap_exceeded (429), governance가 명명한 code", async () => {
    // spentUsd >= cap 이 되도록 캡 0짜리 키
    const sealed = await getCrypto().seal("sk-dummy", { tenantId: String(tenantId) });
    await EndUserKey.create({
      tenantId, environment: "live", endUserLabel: "capped", provider: "openai",
      keyEncrypted: sealed.ciphertext, keyMasked: "x", cryptoVersion: sealed.cryptoVersion,
      validationState: "valid", isActive: true, isPaid: true, spendCapUsd: 1, spentUsd: 5,
    });
    const res = await authenticateAndAuthorize(req(liveSecret, "capped"), P);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(429);
    expect(await codeOf(res)).toBe("spend_cap_exceeded");
  });
});

describe("v1 에러 응답 모양", () => {
  it("doc_url과 request_id가 항상 채워진다", async () => {
    const res = await authenticateAndAuthorize(req("bad"), P);
    if (!res.ok) {
      const body = await res.response.json();
      expect(body.error.doc_url).toMatch(/\/docs#relay_key_invalid$/);
      expect(body.error.request_id).toBe("req-test");
      expect(res.response.headers.get("X-Relay-Request-Id")).toBe("req-test");
    }
  });
});
