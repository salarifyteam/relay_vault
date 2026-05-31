import { NextResponse } from "next/server";
import { getCurrentDeveloper } from "@/lib/auth";
import { requireRole } from "@/lib/requireRole";
import { recordAudit } from "@/lib/audit";
import ApiKey from "@/lib/models/ApiKey";
import { revokeApiKey } from "@/lib/services/apiKeyService";

// API 키 폐기(소프트). 활성 테넌트 소속 키만 폐기 가능.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentDeveloper();
  if (!me) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }
  const forbidden = requireRole(me, "member");
  if (forbidden) return forbidden;

  const { id } = await params;
  // 소유권 확인: 다른 테넌트의 키를 폐기하지 못하도록 tenantId로 스코프.
  const key = await ApiKey.findOne({ _id: id, tenantId: me.tenant._id });
  if (!key) {
    return NextResponse.json({ error: { message: "Key not found" } }, { status: 404 });
  }

  await revokeApiKey(String(key._id));

  await recordAudit({
    tenantId: String(me.tenant._id),
    accountId: String(me.account._id),
    actorEmail: me.account.email,
    action: "api_key_revoked",
    target: String(key._id),
    detail: `${key.environment} key "${key.name}" (${key.prefix}…${key.last4})`,
  });

  return NextResponse.json({ ok: true });
}
