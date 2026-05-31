import mongoose from "mongoose";
import RateCounter from "@/lib/models/RateCounter";
import type { Environment } from "@/lib/keys";

const WINDOW_MS = 60_000;

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

// 테넌트×환경별 고정윈도(1분) 요청 제한. 원자적 $inc로 카운트하고 한도 초과면 차단.
// Cloud Run 다중 인스턴스에서 공유 DB로 동작하므로 교차-정확하다(추후 Redis로 교체 가능).
export async function checkRateLimit(
  tenantId: mongoose.Types.ObjectId,
  environment: Environment,
  limitPerMin: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS);

  const doc = await RateCounter.findOneAndUpdate(
    { tenantId, environment, windowStart },
    { $inc: { count: 1 }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: true }
  );

  if (doc.count > limitPerMin) {
    const nextWindow = windowStart.getTime() + WINDOW_MS;
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((nextWindow - now) / 1000)) };
  }
  return { ok: true, retryAfterSec: 0 };
}
