import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/authConstants";

// 프록시 뒤에서 req.url 호스트가 내부 주소(0.0.0.0)일 수 있어 공개 base를 우선 사용
function redirectTo(path: string, req: NextRequest) {
  const url = process.env.APP_BASE_URL
    ? new URL(path, process.env.APP_BASE_URL)
    : new URL(path, req.url);
  return NextResponse.redirect(url);
}

// "/" : 세션 쿠키 있으면 콘솔로(랜딩 건너뜀), 없으면 랜딩 표시.
// "/console*" : 세션 쿠키 없으면 /login으로. (DB 검증은 페이지/‧api에서)
export function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (req.nextUrl.pathname === "/") {
    return hasSession ? redirectTo("/console", req) : NextResponse.next();
  }

  // /console*
  if (!hasSession) return redirectTo("/login", req);
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/console/:path*"],
};
