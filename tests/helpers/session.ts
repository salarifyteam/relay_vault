import crypto from "crypto";
import mongoose from "mongoose";
import DeveloperAccount from "@/lib/models/DeveloperAccount";
import Tenant from "@/lib/models/Tenant";
import TenantMember from "@/lib/models/TenantMember";
import Session from "@/lib/models/Session";
import { mintApiKey } from "@/lib/services/apiKeyService";
import type { Environment } from "@/lib/keys";
import { connectTestDb } from "./db";

// 테스트용 — DB에 계정/테넌트/멤버십/세션 + (기본)live API 키를 직접 만들고 쿠키 헤더를 돌려준다.
// 실제 OAuth 없이 API 테스트에서 인증된 요청을 보낼 수 있게.
// 반환의 apiKey는 평문(해시 저장이라 여기서만 얻을 수 있음). rlyKey는 동일 값의 하위호환 별칭.
export async function createTestSession(opts?: {
  email?: string;
  role?: "owner" | "member";
  tenantName?: string;
  environment?: Environment; // 기본 live — 기존 테스트 동작 유지
}): Promise<{
  cookie: string;
  sessionId: string;
  accountId: string;
  tenantId: string;
  apiKey: string;
  rlyKey: string; // = apiKey (하위호환 별칭)
  environment: Environment;
}> {
  await connectTestDb();
  const environment = opts?.environment || "live";
  const email = opts?.email || `test-${crypto.randomBytes(4).toString("hex")}@test`;
  const account = await DeveloperAccount.create({
    googleSub: "sub-" + crypto.randomBytes(8).toString("hex"),
    email,
  });
  const tenant = await Tenant.create({
    name: opts?.tenantName || `Tenant ${email}`,
    plan: "free",
    ownerAccountId: account._id,
  });
  const minted = await mintApiKey({ tenantId: String(tenant._id), environment, name: "test" });
  await TenantMember.create({
    tenantId: tenant._id,
    accountId: account._id,
    role: opts?.role || "owner",
    joinedAt: new Date(),
  });
  const sessionId = crypto.randomBytes(32).toString("hex");
  await Session.create({
    sessionId,
    accountId: account._id,
    activeTenantId: tenant._id,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  });
  return {
    cookie: `__session=${sessionId}`,
    sessionId,
    accountId: String(account._id),
    tenantId: String(tenant._id),
    apiKey: minted.secret,
    rlyKey: minted.secret,
    environment,
  };
}

// 테넌트에 추가 API 키 발급(테스트용). 평문 반환.
export async function mintTestKey(
  tenantId: string,
  environment: Environment,
  name = "test"
): Promise<string> {
  await connectTestDb();
  const minted = await mintApiKey({ tenantId, environment, name });
  return minted.secret;
}

// 같은 테넌트에 다른 멤버 추가
export async function addMemberToTenant(
  tenantId: string,
  role: "owner" | "member" = "member"
): Promise<{ cookie: string; accountId: string; email: string }> {
  await connectTestDb();
  const email = `member-${crypto.randomBytes(4).toString("hex")}@test`;
  const account = await DeveloperAccount.create({
    googleSub: "sub-" + crypto.randomBytes(8).toString("hex"),
    email,
  });
  await TenantMember.create({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    accountId: account._id,
    role,
    joinedAt: new Date(),
  });
  const sessionId = crypto.randomBytes(32).toString("hex");
  await Session.create({
    sessionId,
    accountId: account._id,
    activeTenantId: new mongoose.Types.ObjectId(tenantId),
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  });
  return { cookie: `__session=${sessionId}`, accountId: String(account._id), email };
}

// dev 서버가 떠 있는지 확인 — 안 떠 있으면 API 테스트는 skip
export async function isDevServerUp(baseUrl = "http://localhost:3000"): Promise<boolean> {
  try {
    const r = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}
