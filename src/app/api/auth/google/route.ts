import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/googleOAuth";
import { SESSION_COOKIE_NAME } from "@/lib/authConstants";

// next 경로를 state에 안전하게 동봉(상대경로만 허용 — 오픈 리디렉트 방지).
function encodeState(next: string | null): string {
  const rand = crypto.randomBytes(16).toString("hex");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return rand;
  return rand + "." + Buffer.from(next, "utf8").toString("base64url");
}

export async function GET(req: NextRequest) {
  const client = getOAuthClient();
  const next = new URL(req.url).searchParams.get("next");
  const state = encodeState(next);

  const url = client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
  });

  const res = NextResponse.redirect(url);
  // CSRF: state를 쿠키에 보관해 콜백에서 대조.
  // Firebase Hosting은 __session 쿠키만 백엔드로 전달하므로 그 이름을 써야 콜백에 도달함.
  // (로그인 성공 시 콜백이 __session을 실제 세션ID로 덮어씀)
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
