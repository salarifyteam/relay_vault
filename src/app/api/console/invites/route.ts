import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentDeveloper } from "@/lib/auth";
import TenantInvite from "@/lib/models/TenantInvite";
import { requireRole } from "@/lib/requireRole";
import { recordAudit } from "@/lib/audit";

const INVITE_TTL_DAYS = 7;

function appBase(req: NextRequest): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  return new URL(req.url).origin;
}

// 새 초대 토큰 생성. owner 전용.
export async function POST(req: NextRequest) {
  const me = await getCurrentDeveloper();
  if (!me) return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  const forbidden = requireRole(me, "owner");
  if (forbidden) return forbidden;

  const token = "inv-" + crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  await TenantInvite.create({
    token,
    tenantId: me.tenant._id,
    invitedBy: me.account._id,
    role: "member",
    expiresAt,
  });
  await recordAudit({
    tenantId: String(me.tenant._id),
    accountId: String(me.account._id),
    actorEmail: me.account.email,
    action: "member_invited",
    target: "invite",
  });
  const inviteUrl = `${appBase(req)}/invite/${token}`;
  return NextResponse.json({ inviteUrl, token, expiresAt: expiresAt.toISOString() });
}

// 활성 초대 목록(만료/사용 제외). owner 전용.
export async function GET() {
  const me = await getCurrentDeveloper();
  if (!me) return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  const forbidden = requireRole(me, "owner");
  if (forbidden) return forbidden;

  const invites = await TenantInvite.find({
    tenantId: me.tenant._id,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  return NextResponse.json({
    invites: invites.map((i) => ({
      token: i.token,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    })),
  });
}

// 초대 폐기. owner 전용.
export async function DELETE(req: NextRequest) {
  const me = await getCurrentDeveloper();
  if (!me) return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  const forbidden = requireRole(me, "owner");
  if (forbidden) return forbidden;
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: { message: "Missing token" } }, { status: 400 });
  await TenantInvite.deleteOne({ token, tenantId: me.tenant._id });
  return NextResponse.json({ ok: true });
}
