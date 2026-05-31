import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import RateCounter from "@/lib/models/RateCounter";
import { checkRateLimit } from "@/lib/rateLimit";
import { clearAllTestCollections, disconnectTestDb } from "../helpers/db";

beforeAll(async () => {
  await clearAllTestCollections();
});
beforeEach(async () => {
  await RateCounter.deleteMany({});
});
afterAll(async () => {
  await disconnectTestDb();
});

describe("checkRateLimit — 테넌트별 분당 카운터", () => {
  it("한도 내: 모두 통과", async () => {
    const tid = new mongoose.Types.ObjectId();
    for (let i = 0; i < 5; i++) {
      const r = await checkRateLimit(tid, "live", 10);
      expect(r.ok).toBe(true);
    }
  });

  it("한도 초과: ok=false + retryAfterSec>0", async () => {
    const tid = new mongoose.Types.ObjectId();
    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit(tid, "live", 3);
      expect(r.ok).toBe(true);
    }
    const blocked = await checkRateLimit(tid, "live", 3);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("테넌트 간 격리(서로의 카운터 무관)", async () => {
    const tA = new mongoose.Types.ObjectId();
    const tB = new mongoose.Types.ObjectId();
    for (let i = 0; i < 5; i++) await checkRateLimit(tA, "live", 5);
    // A는 한도 도달
    expect((await checkRateLimit(tA, "live", 5)).ok).toBe(false);
    // B는 영향 없음
    expect((await checkRateLimit(tB, "live", 5)).ok).toBe(true);
  });

  it("한도 = 0이면 1회도 통과 안 함", async () => {
    const tid = new mongoose.Types.ObjectId();
    const r = await checkRateLimit(tid, "live", 0);
    expect(r.ok).toBe(false);
  });
});
