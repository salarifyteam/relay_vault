import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/authConstants";

// /console* 보호: 세션 쿠키 없으면 /login으로. (DB 검증은 페이지/‧api에서)
export function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!hasSession) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/console/:path*"],
};
