import { NextResponse } from "next/server";
import { getCurrentDeveloper } from "@/lib/auth";
import { requireRole } from "@/lib/requireRole";
import { recordAudit } from "@/lib/audit";
import ApiKey from "@/lib/models/ApiKey";
import { mintApiKey, revokeApiKey } from "@/lib/services/apiKeyService";

// 키 롤: 같은 환경·이름으로 새 키를 발급하고 기존 키를 폐기한다.
// 새 평문은 응답에 1회만 포함. (구 키는 즉시 무효 — 무중단 교체는 새 키 발급→배포→구 키 폐기 순으로 별도 진행)
export async function POST(
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
  const old = await ApiKey.findOne({ _id: id, tenantId: me.tenant._id, status: "active" });
  if (!old) {
    return NextResponse.json({ error: { message: "Active key not found" } }, { status: 404 });
  }

  const minted = await mintApiKey({
    tenantId: String(me.tenant._id),
    environment: old.environment,
    name: old.name,
    createdByAccountId: String(me.account._id),
  });
  await revokeApiKey(String(old._id));

  await recordAudit({
    tenantId: String(me.tenant._id),
    accountId: String(me.account._id),
    actorEmail: me.account.email,
    action: "api_key_rolled",
    target: minted.id,
    detail: `rolled ${old.environment} key "${old.name}" → ${minted.prefix}…${minted.last4}`,
  });

  return NextResponse.json(
    {
      id: minted.id,
      secret: minted.secret,
      environment: minted.environment,
      prefix: minted.prefix,
      last4: minted.last4,
      name: minted.name,
      revokedId: String(old._id),
    },
    { status: 201 }
  );
}
