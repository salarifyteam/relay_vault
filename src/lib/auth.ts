import crypto from "crypto";
import mongoose from "mongoose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import DeveloperAccount, { IDeveloperAccount } from "@/lib/models/DeveloperAccount";
import Session from "@/lib/models/Session";
import Tenant, { ITenant } from "@/lib/models/Tenant";
import TenantMember, { type TenantRole } from "@/lib/models/TenantMember";
import { SESSION_COOKIE_NAME } from "@/lib/authConstants";

export { SESSION_COOKIE_NAME };
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);

export async function createSession(accountId: string): Promise<{ sessionId: string; expiresAt: Date }> {
  await dbConnect();
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
  await Session.create({ sessionId, accountId, expiresAt });
  return { sessionId, expiresAt };
}

export async function destroySession(sessionId: string | undefined | null) {
  if (!sessionId) return;
  await dbConnect();
  await Session.deleteOne({ sessionId });
}

export function setSessionCookie(res: NextResponse, sessionId: string, expiresAt: Date) {
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export interface TenantBrief {
  _id: mongoose.Types.ObjectId;
  name: string;
  role: TenantRole;
}

export interface CurrentDeveloper {
  account: IDeveloperAccount;
  tenant: ITenant; // 현재 활성 테넌트
  role: TenantRole; // 활성 테넌트에서의 역할
  memberships: TenantBrief[]; // picker용 — 이 계정이 속한 모든 테넌트
}

// 쿠키 → 세션 → 계정 + (활성)테넌트 + 역할 + 전체 멤버십.
// 활성 테넌트는 세션의 activeTenantId. 누락/무효하면 멤버십 첫 항목으로 폴백 + 세션 업데이트.
// 멤버십 0개면(첫 로그인) ensureTenant로 개인 테넌트 + owner 멤버십을 만든다.
export async function getCurrentDeveloper(): Promise<CurrentDeveloper | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;

  await dbConnect();
  const session = await Session.findOne({ sessionId, expiresAt: { $gt: new Date() } });
  if (!session) return null;

  const account = await DeveloperAccount.findById(session.accountId);
  if (!account) return null;
  const accountId = account._id as mongoose.Types.ObjectId;

  // 멤버십 로드. 0개면(=첫 로그인) 개인 테넌트+owner 멤버십 생성.
  let members = await TenantMember.find({ accountId }).sort({ joinedAt: 1 }).lean();
  if (members.length === 0) {
    await ensureTenant(String(accountId));
    members = await TenantMember.find({ accountId }).sort({ joinedAt: 1 }).lean();
  }

  // 활성 테넌트 결정: 세션의 activeTenantId가 유효한 멤버십이면 사용, 아니면 첫 항목 폴백.
  let activeMember = session.activeTenantId
    ? members.find((m) => String(m.tenantId) === String(session.activeTenantId))
    : undefined;
  if (!activeMember) {
    activeMember = members[0];
    session.activeTenantId = activeMember.tenantId as mongoose.Types.ObjectId;
    await session.save();
  }

  const tenant = await Tenant.findById(activeMember.tenantId);
  if (!tenant) return null;

  // memberships 요약(이름 포함) — picker용
  const tenantIds = members.map((m) => m.tenantId);
  const tenants = await Tenant.find({ _id: { $in: tenantIds } }).select({ name: 1 }).lean();
  const tenantNameById = new Map(tenants.map((t) => [String(t._id), t.name]));
  const memberships: TenantBrief[] = members.map((m) => ({
    _id: m.tenantId as mongoose.Types.ObjectId,
    name: tenantNameById.get(String(m.tenantId)) || "(unknown)",
    role: m.role as TenantRole,
  }));

  return { account, tenant, role: activeMember.role as TenantRole, memberships };
}

// 개발자당 기본 테넌트 보장 (첫 로그인). Tenant + 본인의 owner TenantMember를 함께 생성.
// 키는 자동 발급하지 않는다 — 평문은 생성 시 1회만 노출되므로, 콘솔 keys 페이지에서
// 사용자가 직접 test/live 키를 만들고 그 자리에서 복사한다(Stripe와 동일한 reveal-once UX).
export async function ensureTenant(accountId: string): Promise<ITenant> {
  await dbConnect();
  let tenant = await Tenant.findOne({ ownerAccountId: accountId });
  if (!tenant) {
    tenant = await Tenant.create({
      name: "My App",
      allowedOrigins: [],
      ownerAccountId: accountId,
    });
  }
  // owner 멤버십 보장(중복 안전)
  await TenantMember.updateOne(
    { tenantId: tenant._id, accountId },
    { $setOnInsert: { tenantId: tenant._id, accountId, role: "owner", joinedAt: new Date() } },
    { upsert: true }
  );
  return tenant;
}

// 구글 프로필 → 계정 upsert
export async function upsertDeveloper(profile: {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}): Promise<IDeveloperAccount> {
  await dbConnect();
  const account = await DeveloperAccount.findOneAndUpdate(
    { googleSub: profile.sub },
    {
      googleSub: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    },
    { upsert: true, new: true }
  );
  return account!;
}
