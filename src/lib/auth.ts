import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import DeveloperAccount, { IDeveloperAccount } from "@/lib/models/DeveloperAccount";
import Session from "@/lib/models/Session";
import Tenant, { ITenant } from "@/lib/models/Tenant";
import { generateRlyKey } from "@/lib/keys";
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

export interface CurrentDeveloper {
  account: IDeveloperAccount;
  tenant: ITenant;
}

// 쿠키 → 세션 → 계정 + 소유 테넌트
export async function getCurrentDeveloper(): Promise<CurrentDeveloper | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;

  await dbConnect();
  const session = await Session.findOne({ sessionId, expiresAt: { $gt: new Date() } });
  if (!session) return null;

  const account = await DeveloperAccount.findById(session.accountId);
  if (!account) return null;

  const tenant = await ensureTenant(String(account._id));
  return { account, tenant };
}

// 개발자당 기본 테넌트 보장 (첫 로그인 시 생성)
export async function ensureTenant(accountId: string): Promise<ITenant> {
  await dbConnect();
  let tenant = await Tenant.findOne({ ownerAccountId: accountId });
  if (!tenant) {
    tenant = await Tenant.create({
      name: "My App",
      rlyKey: generateRlyKey(),
      allowedOrigins: [],
      ownerAccountId: accountId,
    });
  }
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
