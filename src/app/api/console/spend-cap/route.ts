import { NextRequest, NextResponse } from "next/server";
import { getCurrentDeveloper } from "@/lib/auth";
import Tenant from "@/lib/models/Tenant";
import { recordAudit } from "@/lib/audit";

// 테넌트 기본 스펜드캡(엔드유저당 USD 한도) 설정. null/빈값이면 무제한(해제).
export async function PATCH(req: NextRequest) {
  const me = await getCurrentDeveloper();
  if (!me) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }

  let body: { defaultUserSpendCapUsd?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }

  const raw = body.defaultUserSpendCapUsd;
  let cap: number | undefined;
  if (raw === null || raw === "" || raw === undefined) {
    cap = undefined; // 해제
  } else {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: { message: "defaultUserSpendCapUsd must be a non-negative number or null" } }, { status: 400 });
    }
    cap = n;
  }

  await Tenant.updateOne(
    { _id: me.tenant._id },
    cap === undefined ? { $unset: { defaultUserSpendCapUsd: "" } } : { $set: { defaultUserSpendCapUsd: cap } }
  );

  await recordAudit({
    tenantId: String(me.tenant._id),
    accountId: String(me.account._id),
    actorEmail: me.account.email,
    action: "spend_cap_updated",
    target: "tenant",
    detail: cap === undefined ? "cleared" : `$${cap}`,
  });

  return NextResponse.json({ defaultUserSpendCapUsd: cap ?? null });
}
