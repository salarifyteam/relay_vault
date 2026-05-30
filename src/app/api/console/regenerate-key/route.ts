import { NextResponse } from "next/server";
import { getCurrentDeveloper } from "@/lib/auth";
import { generateRlyKey } from "@/lib/keys";
import Tenant from "@/lib/models/Tenant";
import { maskByokKey } from "@/lib/services/byokProvider";
import { recordAudit } from "@/lib/audit";
import { requireRole } from "@/lib/requireRole";

export async function POST() {
  const me = await getCurrentDeveloper();
  if (!me) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }
  const forbidden = requireRole(me, "member");
  if (forbidden) return forbidden;
  const rlyKey = generateRlyKey();
  await Tenant.updateOne({ _id: me.tenant._id }, { $set: { rlyKey } });
  await recordAudit({
    tenantId: String(me.tenant._id),
    accountId: String(me.account._id),
    actorEmail: me.account.email,
    action: "key_regenerated",
    target: "tenant",
  });
  return NextResponse.json({ rlyKey, rlyKeyMasked: maskByokKey(rlyKey) });
}
