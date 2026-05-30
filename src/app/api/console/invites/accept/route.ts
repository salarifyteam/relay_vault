import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentDeveloper } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/authConstants";
import Session from "@/lib/models/Session";
import TenantInvite from "@/lib/models/TenantInvite";
import TenantMember from "@/lib/models/TenantMember";
import { recordAudit } from "@/lib/audit";

// 초대 수락. 로그인 필수. 이미 멤버면 멱등(활성 테넌트만 전환).
export async function POST(req: NextRequest) {
  const me = await getCurrentDeveloper();
  if (!me) return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });

  let body: { token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: { message: "Missing token" } }, { status: 400 });

  const invite = await TenantInvite.findOne({ token });
  if (!invite) return NextResponse.json({ error: { message: "Invalid invite" } }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: { message: "Invite already used" } }, { status: 410 });
  if (invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: { message: "Invite expired" } }, { status: 410 });
  }

  // 멤버십 upsert(중복 안전 — 이미 멤버면 변경 없음)
  const existing = await TenantMember.findOne({ tenantId: invite.tenantId, accountId: me.account._id });
  if (!existing) {
    await TenantMember.create({
      tenantId: invite.tenantId,
      accountId: me.account._id,
      role: invite.role, // "member"
      joinedAt: new Date(),
    });
    await recordAudit({
      tenantId: String(invite.tenantId),
      accountId: String(me.account._id),
      actorEmail: me.account.email,
      action: "member_invited",
      target: me.account.email,
      detail: "accepted",
    });
  }

  // 초대 1회용 마킹
  invite.usedAt = new Date();
  await invite.save();

  // 활성 테넌트를 이 테넌트로 전환
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sessionId) {
    await Session.updateOne({ sessionId }, { $set: { activeTenantId: invite.tenantId } });
  }

  return NextResponse.json({ ok: true, tenantId: String(invite.tenantId) });
}
