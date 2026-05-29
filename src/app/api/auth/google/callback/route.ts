import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/googleOAuth";
import {
  upsertDeveloper,
  ensureTenant,
  createSession,
  setSessionCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

// 프록시(Firebase Hosting→Cloud Run) 뒤에서는 req.url 호스트가 내부 주소(0.0.0.0)일 수 있어
// 공개 base URL을 명시 env / OAUTH_REDIRECT_URI origin 에서 가져온다.
function appBase(req: NextRequest): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  if (process.env.OAUTH_REDIRECT_URI) {
    try {
      return new URL(process.env.OAUTH_REDIRECT_URI).origin;
    } catch {
      /* fall through */
    }
  }
  return new URL(req.url).origin;
}

function loginError(req: NextRequest, reason: string) {
  const url = new URL("/login", appBase(req));
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  // state는 __session 쿠키로 전달됨(Firebase Hosting이 __session만 포워딩)
  const cookieState = req.cookies.get(SESSION_COOKIE_NAME)?.value;

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

  const res = NextResponse.redirect(new URL("/console", appBase(req)));
  setSessionCookie(res, sessionId, expiresAt); // __session을 실제 세션ID로 덮어씀
  return res;
}
