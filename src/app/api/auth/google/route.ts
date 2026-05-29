import crypto from "crypto";
import { NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/googleOAuth";
import { SESSION_COOKIE_NAME } from "@/lib/authConstants";

export async function GET() {
  const client = getOAuthClient();
  const state = crypto.randomBytes(16).toString("hex");

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
