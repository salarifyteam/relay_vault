import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import Tenant from "@/lib/models/Tenant";
import ApiKey from "@/lib/models/ApiKey";
import EndUserKey from "@/lib/models/EndUserKey";
import UsageRecord from "@/lib/models/UsageRecord";
import RateCounter from "@/lib/models/RateCounter";
import { authenticateAndAuthorize, recordUsage } from "@/lib/proxyCommon";
import { mintApiKey, revokeApiKey } from "@/lib/services/apiKeyService";
import { getActiveKeyStats } from "@/lib/usageStats";
import { getCrypto } from "@/lib/crypto";
import type { Environment } from "@/lib/keys";
import type { ByokProvider } from "@/lib/services/byokProvider";
import { clearAllTestCollections, disconnectTestDb } from "../helpers/db";

let tenantId: mongoose.Types.ObjectId;

beforeAll(async () => {
  await clearAllTestCollections();
  // 구 스키마의 유니크 인덱스(environment 미포함)가 테스트 DB에 남아 있으면 test/live
  // 동일 키 등록이 충돌한다. 마이그레이션과 동일하게 syncIndexes로 정리한다.
  await EndUserKey.syncIndexes();
  await RateCounter.syncIndexes();
  await UsageRecord.syncIndexes();
  const t = await Tenant.create({ name: "Iso", plan: "growth" });
  tenantId = t._id as mongoose.Types.ObjectId;
});

beforeEach(async () => {
  await ApiKey.deleteMany({});
  await EndUserKey.deleteMany({});
  await UsageRecord.deleteMany({});
  await RateCounter.deleteMany({});
});

afterAll(async () => {
  await disconnectTestDb();
});

// 테스트용 EndUserKey 생성(환경 지정). 실제 seal로 복호화 가능한 암호문을 넣는다
// (auth 마지막 단계가 getCrypto().open을 호출하므로 더미 'x'면 500이 난다).
async function makeEndUserKey(
  environment: Environment,
  label = "alice",
  provider: ByokProvider = "openai"
) {
  const sealed = await getCrypto().seal("sk-dummy-secret", { tenantId: String(tenantId) });
  return EndUserKey.create({
    tenantId,
    environment,
    endUserLabel: label,
    provider,
    keyEncrypted: sealed.ciphertext,
    keyMasked: "sk-...xx",
    cryptoVersion: sealed.cryptoVersion,
    wrappedDataKey: sealed.wrappedDataKey,
    validationState: "valid",
    isActive: true,
    isPaid: true,
  });
}

// chat/completions가 만드는 것과 동일한 형태의 인증 요청.
function authRequest(secret: string, user = "alice") {
  return new NextRequest("https://relay.test/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "x-relay-user": user,
      "content-type": "application/json",
    },
  });
}

const params = { provider: "openai" as const, model: "gpt-4o-mini", requestId: "req-test" };

describe("환경 격리 — authenticateAndAuthorize", () => {
  it("live 키 → environment=live 로 해석되고 live EndUserKey를 본다", async () => {
    const live = await mintApiKey({ tenantId: String(tenantId), environment: "live", name: "k" });
    await makeEndUserKey("live");

    const res = await authenticateAndAuthorize(authRequest(live.secret), params);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ctx.environment).toBe("live");
      expect(res.ctx.ids.environment).toBe("live");
    }
  });

  it("★ test 키는 같은 라벨의 live EndUserKey를 보지 못한다 (404)", async () => {
    // live EndUserKey만 존재. test 키로 요청하면 그 키는 보이지 않아야 한다.
    await makeEndUserKey("live");
    const test = await mintApiKey({ tenantId: String(tenantId), environment: "test", name: "k" });

    const res = await authenticateAndAuthorize(authRequest(test.secret), params);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(404);
  });

  it("test 키 + test EndUserKey → environment=test 로 해석", async () => {
    await makeEndUserKey("test");
    const test = await mintApiKey({ tenantId: String(tenantId), environment: "test", name: "k" });

    const res = await authenticateAndAuthorize(authRequest(test.secret), params);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.ctx.environment).toBe("test");
  });

  it("같은 라벨이 test/live 양쪽에 독립적으로 등록 가능(유니크 인덱스가 환경 포함)", async () => {
    // 둘 다 같은 (tenantId, label, provider) 이지만 environment가 달라 충돌하지 않아야 한다.
    await makeEndUserKey("live");
    await expect(makeEndUserKey("test")).resolves.toBeTruthy();
  });

  it("폐기된 키 → 401", async () => {
    const k = await mintApiKey({ tenantId: String(tenantId), environment: "live", name: "k" });
    await makeEndUserKey("live");
    await revokeApiKey(k.id);

    const res = await authenticateAndAuthorize(authRequest(k.secret), params);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(401);
  });

  it("알 수 없는 키 → 401", async () => {
    const res = await authenticateAndAuthorize(authRequest("rly_live_nonexistent"), params);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(401);
  });
});

describe("환경 격리 — 사용량/레이트리밋", () => {
  it("recordUsage가 environment를 기록하고 getActiveKeyStats가 환경별로 분리한다", async () => {
    // live 1건, test 1건 기록(서로 다른 라벨)
    await recordUsage({
      tenantId, environment: "live", endUserKeyId: new mongoose.Types.ObjectId(),
      endUserLabel: "live-user", provider: "openai", model: "gpt-4o-mini",
      isPaid: true, usage: { prompt_tokens: 5, completion_tokens: 5 }, stream: false,
    });
    await recordUsage({
      tenantId, environment: "test", endUserKeyId: new mongoose.Types.ObjectId(),
      endUserLabel: "test-user", provider: "openai", model: "gpt-4o-mini",
      isPaid: true, usage: { prompt_tokens: 5, completion_tokens: 5 }, stream: false,
    });

    const liveStats = await getActiveKeyStats(String(tenantId), "live");
    const testStats = await getActiveKeyStats(String(tenantId), "test");
    // 각 환경은 자기 환경의 활성 키만 센다.
    expect(liveStats.allActiveKeys).toBe(1);
    expect(testStats.allActiveKeys).toBe(1);
  });

  it("test 트래픽이 live 레이트리밋 카운터를 소모하지 않는다(분리 카운터)", async () => {
    // free 플랜이 아닌 growth 테넌트라 reqPerMin이 크다 → 한도 차단이 아니라 '카운터 분리'를 검증.
    const live = await mintApiKey({ tenantId: String(tenantId), environment: "live", name: "L" });
    const test = await mintApiKey({ tenantId: String(tenantId), environment: "test", name: "T" });
    await makeEndUserKey("live", "alice");
    await makeEndUserKey("test", "alice");

    await authenticateAndAuthorize(authRequest(live.secret), params);
    await authenticateAndAuthorize(authRequest(test.secret), params);

    const liveCounters = await RateCounter.find({ tenantId, environment: "live" });
    const testCounters = await RateCounter.find({ tenantId, environment: "test" });
    // 각 환경에 독립된 카운터 행이 생긴다(합쳐지지 않음).
    expect(liveCounters.length).toBe(1);
    expect(testCounters.length).toBe(1);
    expect(liveCounters[0].count).toBe(1);
    expect(testCounters[0].count).toBe(1);
  });
});
