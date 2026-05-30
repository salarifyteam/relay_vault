import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import { getCurrentDeveloper } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/authConstants";
import Session from "@/lib/models/Session";
import TenantMember from "@/lib/models/TenantMember";

// 활성 테넌트 전환. 본인이 그 테넌트의 멤버인지 검증.
export async function POST(req: NextRequest) {
  const me = await getCurrentDeveloper();
  if (!me) return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });

  let body: { tenantId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }
  const tenantIdStr = typeof body.tenantId === "string" ? body.tenantId : "";
  if (!mongoose.isValidObjectId(tenantIdStr)) {
    return NextResponse.json({ error: { message: "Invalid tenantId" } }, { status: 400 });
  }
  const tenantId = new mongoose.Types.ObjectId(tenantIdStr);

  const member = await TenantMember.findOne({ tenantId, accountId: me.account._id });
  if (!member) return NextResponse.json({ error: { message: "Not a member of that tenant" } }, { status: 403 });

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sessionId) {
    await Session.updateOne({ sessionId }, { $set: { activeTenantId: tenantId } });
  }
  return NextResponse.json({ ok: true });
}
