import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/authConstants";

// /console* 보호: 세션 쿠키 없으면 /login으로. (DB 검증은 페이지/‧api에서)
export function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!hasSession) {
    // 프록시 뒤에서 req.url 호스트가 내부 주소(0.0.0.0)일 수 있어 공개 base를 우선 사용
    const url = process.env.APP_BASE_URL
      ? new URL("/login", process.env.APP_BASE_URL)
      : new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/console/:path*"],
};
