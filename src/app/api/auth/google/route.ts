import crypto from "crypto";
import { NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/googleOAuth";

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
  // CSRF: state를 짧은 수명 쿠키에 보관해 콜백에서 대조
  res.cookies.set({
    name: "oauth_state",
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
