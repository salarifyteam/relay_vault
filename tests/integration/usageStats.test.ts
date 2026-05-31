import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import mongoose from "mongoose";
import Tenant from "@/lib/models/Tenant";
import EndUserKey from "@/lib/models/EndUserKey";
import UsageRecord from "@/lib/models/UsageRecord";
import { getActiveKeyStats, getTenantUsage, isKeyActiveThisMonth, currentMonthStart } from "@/lib/usageStats";
import { clearAllTestCollections, disconnectTestDb } from "../helpers/db";

let tenantA: mongoose.Types.ObjectId;
let tenantB: mongoose.Types.ObjectId;

beforeAll(async () => {
  await clearAllTestCollections();
  const a = await Tenant.create({ name: "A", plan: "growth" });
  const b = await Tenant.create({ name: "B", plan: "free" });
  tenantA = a._id as mongoose.Types.ObjectId;
  tenantB = b._id as mongoose.Types.ObjectId;
});

beforeEach(async () => {
  await UsageRecord.deleteMany({});
  await EndUserKey.deleteMany({});
});

afterAll(async () => {
  await disconnectTestDb();
});

async function key(t: mongoose.Types.ObjectId, label: string, provider = "openai", isPaid = true) {
  return EndUserKey.create({
    tenantId: t,
    environment: "live",
    endUserLabel: label,
    provider: provider as "openai" | "anthropic" | "google" | "xai" | "zai",
    keyEncrypted: "x",
    keyMasked: "x...x",
    cryptoVersion: "test",
    validationState: "valid",
    isActive: true,
    isPaid,
  });
}
async function usage(t: mongoose.Types.ObjectId, label: string, provider = "openai", at = new Date()) {
  return UsageRecord.create({
    tenantId: t,
    environment: "live",
    endUserLabel: label,
    provider: provider as "openai" | "anthropic" | "google" | "xai" | "zai",
    modelName: "gpt-4o-mini",
    inputTokens: 10,
    outputTokens: 10,
    cachedInputTokens: 0,
    estimatedCostUsd: 0.001,
    stream: false,
    createdAt: at,
  });
}

describe("getActiveKeyStats — 월별 distinct 활성키 집계", () => {
  it("빈 테넌트: 0/0", async () => {
    const s = await getActiveKeyStats(String(tenantA), "live");
    expect(s).toEqual({ allActiveKeys: 0, paidActiveKeys: 0 });
  });

  it("같은 유저 여러 요청 = 1 키", async () => {
    await key(tenantA, "u1");
    await usage(tenantA, "u1");
    await usage(tenantA, "u1");
    await usage(tenantA, "u1");
    const s = await getActiveKeyStats(String(tenantA), "live");
    expect(s.allActiveKeys).toBe(1);
    expect(s.paidActiveKeys).toBe(1);
  });

  it("3유저: distinct 3", async () => {
    for (const u of ["u1", "u2", "u3"]) {
      await key(tenantA, u);
      await usage(tenantA, u);
    }
    const s = await getActiveKeyStats(String(tenantA), "live");
    expect(s.allActiveKeys).toBe(3);
    expect(s.paidActiveKeys).toBe(3);
  });

  it("isPaid=false 키는 paidActiveKeys 제외", async () => {
    await key(tenantA, "paid_a", "openai", true);
    await key(tenantA, "free_a", "openai", false);
    await usage(tenantA, "paid_a");
    await usage(tenantA, "free_a");
    const s = await getActiveKeyStats(String(tenantA), "live");
    expect(s.allActiveKeys).toBe(2);
    expect(s.paidActiveKeys).toBe(1);
  });

  it("EndUserKey 문서가 없어도(이미 삭제) paid로 카운트(역호환)", async () => {
    // 키 없이 UsageRecord만 (예: 키 폐기 후 과거 사용 기록 남음)
    await usage(tenantA, "ghost");
    const s = await getActiveKeyStats(String(tenantA), "live");
    expect(s.allActiveKeys).toBe(1);
    expect(s.paidActiveKeys).toBe(1); // 키 없으면 isPaid==false가 아니라 true로 카운트
  });

  it("provider별로 distinct(같은 라벨이라도 provider 다르면 2키)", async () => {
    await key(tenantA, "u", "openai");
    await key(tenantA, "u", "google");
    await usage(tenantA, "u", "openai");
    await usage(tenantA, "u", "google");
    const s = await getActiveKeyStats(String(tenantA), "live");
    expect(s.allActiveKeys).toBe(2);
  });

  it("월 경계: 지난달 사용은 제외", async () => {
    await key(tenantA, "old");
    const lastMonth = new Date(currentMonthStart().getTime() - 1000); // monthStart 직전
    await usage(tenantA, "old", "openai", lastMonth);
    const s = await getActiveKeyStats(String(tenantA), "live");
    expect(s.allActiveKeys).toBe(0);
  });

  it("테넌트 격리: A의 활성키는 B에 안 보임", async () => {
    await key(tenantA, "ua");
    await usage(tenantA, "ua");
    await key(tenantB, "ub");
    await usage(tenantB, "ub");
    expect((await getActiveKeyStats(String(tenantA), "live")).allActiveKeys).toBe(1);
    expect((await getActiveKeyStats(String(tenantB), "live")).allActiveKeys).toBe(1);
  });
});

describe("getTenantUsage — 월간 요약", () => {
  it("빈 상태: 0건/0달러", async () => {
    const u = await getTenantUsage(String(tenantA));
    expect(u.requests).toBe(0);
    expect(u.costUsd).toBe(0);
    expect(u.recent).toEqual([]);
  });

  it("요청·비용 합산 + recent 최신순", async () => {
    await key(tenantA, "u1");
    await usage(tenantA, "u1");
    await usage(tenantA, "u1");
    await usage(tenantA, "u1");
    const u = await getTenantUsage(String(tenantA), 10);
    expect(u.requests).toBe(3);
    expect(u.costUsd).toBeCloseTo(0.003, 6);
    expect(u.recent.length).toBe(3);
  });
});

describe("isKeyActiveThisMonth — 하드캡 가드용", () => {
  it("미활성: false", async () => {
    expect(await isKeyActiveThisMonth(tenantA, "live", "fresh", "openai")).toBe(false);
  });
  it("이번달 사용 후: true", async () => {
    await usage(tenantA, "now", "openai");
    expect(await isKeyActiveThisMonth(tenantA, "live", "now", "openai")).toBe(true);
  });
  it("지난달만 사용: false", async () => {
    await usage(tenantA, "past", "openai", new Date(currentMonthStart().getTime() - 1000));
    expect(await isKeyActiveThisMonth(tenantA, "live", "past", "openai")).toBe(false);
  });
});
