import { NextRequest, NextResponse } from "next/server";
import { getCurrentDeveloper } from "@/lib/auth";
import { requireRole } from "@/lib/requireRole";
import { recordAudit } from "@/lib/audit";
import ApiKey from "@/lib/models/ApiKey";
import { mintApiKey, toApiKeyView } from "@/lib/services/apiKeyService";
import type { Environment } from "@/lib/keys";

const ENVS: Environment[] = ["test", "live"];

// 활성 테넌트의 API 키 목록(평문·해시 제외). 폐기된 키도 포함해 반환.
export async function GET() {
  const me = await getCurrentDeveloper();
  if (!me) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }
  const docs = await ApiKey.find({ tenantId: me.tenant._id }).sort({ createdAt: -1 });
  return NextResponse.json({ keys: docs.map(toApiKeyView) });
}

// 새 API 키 발급. 평문은 응답에 1회만 포함된다(다시 조회 불가).
export async function POST(req: NextRequest) {
  const me = await getCurrentDeveloper();
  if (!me) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }
  const forbidden = requireRole(me, "member");
  if (forbidden) return forbidden;

  let body: { environment?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }

  const environment = body.environment as Environment | undefined;
  if (!environment || !ENVS.includes(environment)) {
    return NextResponse.json(
      { error: { message: "environment must be 'test' or 'live'" } },
      { status: 400 }
    );
  }
  const name = body.name?.trim() || "default";

  const minted = await mintApiKey({
    tenantId: String(me.tenant._id),
    environment,
    name,
    createdByAccountId: String(me.account._id),
  });

  await recordAudit({
    tenantId: String(me.tenant._id),
    accountId: String(me.account._id),
    actorEmail: me.account.email,
    action: "api_key_created",
    target: minted.id,
    detail: `${environment} key "${name}" (${minted.prefix}…${minted.last4})`,
  });

  // secret은 여기서만 노출.
  return NextResponse.json(
    {
      id: minted.id,
      secret: minted.secret,
      environment: minted.environment,
      prefix: minted.prefix,
      last4: minted.last4,
      name: minted.name,
    },
    { status: 201 }
  );
}
