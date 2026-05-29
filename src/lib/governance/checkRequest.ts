import type { IEndUserKey } from "@/lib/models/EndUserKey";
import type { ITenant } from "@/lib/models/Tenant";

export interface CheckResult {
  allow: boolean;
  status?: number;
  reason?: string;
}

// 프록시 길목에서 복호화/포워드 직전 1회 호출되는 거버넌스 체크.
// MVP: 스펜드 캡(실제). 허용모델 강제는 별칭/날짜접미사 표기차로 오탐이 많아 제외
// (무권한 모델은 업스트림 프로바이더가 거부). 레이트리밋은 이후.
export function checkRequest(params: {
  endUserKey: IEndUserKey;
  tenant: ITenant;
  model: string;
}): CheckResult {
  const { endUserKey, tenant } = params;

  // 스펜드 캡: 엔드유저 한도 우선, 없으면 테넌트 기본값
  const cap = endUserKey.spendCapUsd ?? tenant.defaultUserSpendCapUsd;
  if (cap != null && endUserKey.spentUsd >= cap) {
    return {
      allow: false,
      status: 429,
      reason: `Spend cap reached ($${endUserKey.spentUsd.toFixed(4)} / $${cap})`,
    };
  }

  return { allow: true };
}
