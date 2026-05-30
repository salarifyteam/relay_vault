import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getCurrentDeveloper } from "@/lib/auth";
import TenantMember from "@/lib/models/TenantMember";
import DeveloperAccount from "@/lib/models/DeveloperAccount";
import { requireRole } from "@/lib/requireRole";
import { recordAudit } from "@/lib/audit";

// 현재 활성 테넌트의 멤버 목록. member 이상.
export async function GET() {
  const me = await getCurrentDeveloper();
  if (!me) return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  const forbidden = requireRole(me, "member");
  if (forbidden) return forbidden;

  const members = await TenantMember.find({ tenantId: me.tenant._id }).sort({ joinedAt: 1 }).lean();
  const accountIds = members.map((m) => m.accountId);
  const accounts = await DeveloperAccount.find({ _id: { $in: accountIds } })
    .select({ email: 1, name: 1, picture: 1 })
    .lean();
  const byId = new Map(accounts.map((a) => [String(a._id), a]));
  return NextResponse.json({
    members: members.map((m) => {
      const a = byId.get(String(m.accountId));
      return {
        accountId: String(m.accountId),
        email: a?.email || "(unknown)",
        name: a?.name,
        picture: a?.picture,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      };
    }),
  });
}

// 멤버 제거. owner 전용. 본인은 제거 불가.
export async function DELETE(req: NextRequest) {
  const me = await getCurrentDeveloper();
  if (!me) return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  const forbidden = requireRole(me, "owner");
  if (forbidden) return forbidden;

  const accountIdStr = new URL(req.url).searchParams.get("accountId");
  if (!accountIdStr || !mongoose.isValidObjectId(accountIdStr)) {
    return NextResponse.json({ error: { message: "Invalid accountId" } }, { status: 400 });
  }
  if (String(me.account._id) === accountIdStr) {
    return NextResponse.json({ error: { message: "Cannot remove yourself" } }, { status: 400 });
  }

  const removed = await TenantMember.findOneAndDelete({
    tenantId: me.tenant._id,
    accountId: new mongoose.Types.ObjectId(accountIdStr),
  });
  if (!removed) return NextResponse.json({ error: { message: "Member not found" } }, { status: 404 });

  await recordAudit({
    tenantId: String(me.tenant._id),
    accountId: String(me.account._id),
    actorEmail: me.account.email,
    action: "member_removed",
    target: accountIdStr,
  });
  return NextResponse.json({ ok: true });
}
