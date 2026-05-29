import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/googleOAuth";
import {
  upsertDeveloper,
  ensureTenant,
  createSession,
  setSessionCookie,
} from "@/lib/auth";

function loginError(req: NextRequest, reason: string) {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = req.cookies.get("oauth_state")?.value;

  if (!code) return loginError(req, "no_code");
  if (!state || !cookieState || state !== cookieState) {
    return loginError(req, "bad_state");
  }

  let payload;
  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) return loginError(req, "no_id_token");
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_OAUTH_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return loginError(req, "exchange_failed");
  }

  if (!payload?.sub || !payload.email) {
    return loginError(req, "no_profile");
  }

  const account = await upsertDeveloper({
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  });
  const accountId = String(account._id);
  await ensureTenant(accountId); // 첫 로그인 시 기본 테넌트 생성

  const { sessionId, expiresAt } = await createSession(accountId);

  const res = NextResponse.redirect(new URL("/console", req.url));
  setSessionCookie(res, sessionId, expiresAt);
  res.cookies.delete("oauth_state");
  return res;
}
