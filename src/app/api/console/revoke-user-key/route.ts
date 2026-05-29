import { NextRequest, NextResponse } from "next/server";
import { getCurrentDeveloper } from "@/lib/auth";
import EndUserKey from "@/lib/models/EndUserKey";
import { recordAudit } from "@/lib/audit";
import type { ByokProvider } from "@/lib/services/byokProvider";

// 특정 엔드유저 BYOK 키를 비활성화(폐기). 테넌트 범위로만 동작.
export async function POST(req: NextRequest) {
  const me = await getCurrentDeveloper();
  if (!me) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }

  let body: { endUserLabel?: unknown; provider?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }
  const endUserLabel = typeof body.endUserLabel === "string" ? body.endUserLabel.trim() : "";
  const provider = typeof body.provider === "string" ? body.provider.trim() : "";
  if (!endUserLabel || !provider) {
    return NextResponse.json(
      { error: { message: "endUserLabel and provider are required" } },
      { status: 400 }
    );
  }

  const res = await EndUserKey.updateOne(
    { tenantId: me.tenant._id, endUserLabel, provider: provider as ByokProvider, isActive: true },
    { $set: { isActive: false } }
  );
  if (res.matchedCount === 0) {
    return NextResponse.json({ error: { message: "No active key found for that user/provider" } }, { status: 404 });
  }

  await recordAudit({
    tenantId: String(me.tenant._id),
    accountId: String(me.account._id),
    actorEmail: me.account.email,
    action: "enduser_key_revoked",
    target: `${endUserLabel}:${provider}`,
  });

  return NextResponse.json({ ok: true });
}
