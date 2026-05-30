import { NextResponse } from "next/server";
import type { CurrentDeveloper } from "@/lib/auth";
import type { TenantRole } from "@/lib/models/TenantMember";

// 역할 순위. owner는 member의 모든 권한을 포함.
const RANK: Record<TenantRole, number> = { member: 1, owner: 2 };

export function hasRole(me: CurrentDeveloper, required: TenantRole): boolean {
  return RANK[me.role] >= RANK[required];
}

// 콘솔 mutation API에서 한 줄 가드. 통과면 null, 미달이면 403 응답 반환.
export function requireRole(me: CurrentDeveloper, required: TenantRole): NextResponse | null {
  if (hasRole(me, required)) return null;
  return NextResponse.json(
    { error: { message: `Requires ${required} role on this tenant` } },
    { status: 403 }
  );
}
