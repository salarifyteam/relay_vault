import { NextResponse } from "next/server";
import { ERROR_CATALOG, docUrlFor, type ErrorCode } from "@/lib/errors/catalog";

// v1 에러 응답 생성기. oaiError를 대체한다.
// status/type은 카탈로그에서 가져오므로 호출 지점이 계약을 어길 수 없다(단일 출처).
// message는 호출 지점에서 넘긴다(동적일 수 있음). code/doc_url/request_id를 항상 채운다.
// requestId는 본문(request_id)과 X-Relay-Request-Id 헤더 둘 다에 동일하게 실린다.
export function relayError(
  code: ErrorCode,
  message: string,
  requestId?: string
): NextResponse {
  const { status, type } = ERROR_CATALOG[code];
  const headers: Record<string, string> = {};
  if (requestId) headers["X-Relay-Request-Id"] = requestId;
  return NextResponse.json(
    {
      error: {
        message,
        type,
        code,
        doc_url: docUrlFor(code),
        request_id: requestId,
      },
    },
    { status, headers }
  );
}
