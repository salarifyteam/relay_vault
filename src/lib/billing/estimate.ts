import { PLANS, type PlanId } from "./plans";

export interface BillEstimate {
  plan: PlanId;
  activeKeys: number;
  includedKeys: number;
  overageKeys: number;
  baseUsd: number;
  overageUsd: number;
  totalUsd: number;
  custom: boolean; // enterprise: 자동 산정 안 함
}

// 활성키 수 → 예상 청구액. 순수 함수(월말 청구 cron이 그대로 소비 예정).
export function estimateBill(plan: PlanId, activeKeys: number): BillEstimate {
  const p = PLANS[plan];
  if (plan === "enterprise") {
    return { plan, activeKeys, includedKeys: 0, overageKeys: 0, baseUsd: 0, overageUsd: 0, totalUsd: 0, custom: true };
  }
  const overageKeys = Math.max(0, activeKeys - p.includedKeys);
  const overageUsd = overageKeys * p.overagePerKeyUsd;
  return {
    plan,
    activeKeys,
    includedKeys: p.includedKeys,
    overageKeys,
    baseUsd: p.baseUsd,
    overageUsd,
    totalUsd: p.baseUsd + overageUsd,
    custom: false,
  };
}

// 현재 활성키 수에서 상위 플랜이 더(또는 같게) 저렴하면 그 플랜 id 반환(브리프 §4-1 업셀 힌트).
const UPGRADE_PATH: Partial<Record<PlanId, PlanId>> = { free: "growth", growth: "scale" };

export function suggestUpgrade(plan: PlanId, activeKeys: number): PlanId | null {
  const next = UPGRADE_PATH[plan];
  if (!next) return null;
  const here = estimateBill(plan, activeKeys).totalUsd;
  const there = estimateBill(next, activeKeys).totalUsd;
  return there <= here ? next : null;
}
