// 요금 설정 한 곳. 숫자는 전부 placeholder(가격 브리프 §3) — 확정되면 이 파일만 교체.
export type PlanId = "free" | "growth" | "scale" | "enterprise";

export interface Plan {
  id: PlanId;
  label: string;
  baseUsd: number; // 월 기본료
  includedKeys: number; // 기본료에 포함된 활성키 수
  overagePerKeyUsd: number; // 포함분 초과 시 활성키당 단가
  hardCapKeys: number | null; // 이 수를 넘는 신규 활성키 차단(Free 전용). null = 무제한
}

export const PLANS: Record<PlanId, Plan> = {
  free: { id: "free", label: "Free", baseUsd: 0, includedKeys: 100, overagePerKeyUsd: 0, hardCapKeys: 100 },
  growth: { id: "growth", label: "Growth", baseUsd: 99, includedKeys: 200, overagePerKeyUsd: 0.8, hardCapKeys: null },
  scale: { id: "scale", label: "Scale", baseUsd: 499, includedKeys: 2000, overagePerKeyUsd: 0.5, hardCapKeys: null },
  enterprise: { id: "enterprise", label: "Enterprise", baseUsd: 0, includedKeys: 0, overagePerKeyUsd: 0, hardCapKeys: null },
};
