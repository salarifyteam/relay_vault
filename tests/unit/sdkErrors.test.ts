import { describe, it, expect } from "vitest";
// SDK 소스를 직접 import(빌드 의존 없이 toRelayError 단위 검증).
import { RelayError, toRelayError } from "../../packages/sdk/src/errors";

// 모의 Response: body(JSON) + 헤더만 가진 최소 구현.
function mockResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
  } as unknown as Response;
}

describe("RelayError — code/docUrl 노출", () => {
  it("positional (message, status, requestId) 하위호환 유지", () => {
    const e = new RelayError("boom", 401, "req-1");
    expect(e.message).toBe("boom");
    expect(e.status).toBe(401);
    expect(e.requestId).toBe("req-1");
    expect(e.code).toBeUndefined();
  });

  it("4번째 옵션 객체로 code/docUrl 설정", () => {
    const e = new RelayError("boom", 401, "req-1", { code: "relay_key_revoked", docUrl: "u" });
    expect(e.code).toBe("relay_key_revoked");
    expect(e.docUrl).toBe("u");
  });
});

describe("toRelayError — 서버 에러 본문 파싱", () => {
  it("error.code / doc_url / request_id를 RelayError로 옮긴다", async () => {
    const res = mockResponse(
      401,
      { error: { message: "Unknown or revoked Relay key", code: "relay_key_revoked", doc_url: "https://x/docs#relay_key_revoked", request_id: "req-9" } },
      { "x-relay-request-id": "req-9" }
    );
    const e = await toRelayError(res);
    expect(e).toBeInstanceOf(RelayError);
    expect(e.status).toBe(401);
    expect(e.code).toBe("relay_key_revoked");
    expect(e.message).toBe("Unknown or revoked Relay key");
    expect(e.docUrl).toBe("https://x/docs#relay_key_revoked");
    expect(e.requestId).toBe("req-9");
  });

  it("code가 없는(구) 응답도 안전하게 처리 — code는 undefined", async () => {
    const res = mockResponse(500, { error: { message: "boom" } });
    const e = await toRelayError(res);
    expect(e.code).toBeUndefined();
    expect(e.message).toBe("boom");
    expect(e.status).toBe(500);
  });

  it("비JSON 본문이면 기본 메시지 유지", async () => {
    const res = {
      status: 502,
      headers: { get: () => null },
      json: async () => { throw new Error("not json"); },
    } as unknown as Response;
    const e = await toRelayError(res);
    expect(e.status).toBe(502);
    expect(e.message).toMatch(/HTTP 502/);
    expect(e.code).toBeUndefined();
  });

  it("헤더에 request_id가 없으면 본문의 request_id로 폴백", async () => {
    const res = mockResponse(429, { error: { message: "slow", code: "rate_limit_exceeded", request_id: "body-req" } });
    const e = await toRelayError(res);
    expect(e.requestId).toBe("body-req");
  });
});
