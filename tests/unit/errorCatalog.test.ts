import { describe, it, expect } from "vitest";
import { ERROR_CATALOG, docUrlFor, type ErrorCode } from "@/lib/errors/catalog";
import { relayError } from "@/lib/errors/relayError";

const CODES = Object.keys(ERROR_CATALOG) as ErrorCode[];

describe("ERROR_CATALOG — 단일 출처 무결성", () => {
  it("17개 코드가 정의돼 있다(코드 추가/삭제 시 의도 확인용 가드)", () => {
    expect(CODES.length).toBe(17);
  });

  it("모든 코드가 유효한 HTTP status(400~599)를 가진다", () => {
    for (const code of CODES) {
      expect(ERROR_CATALOG[code].status).toBeGreaterThanOrEqual(400);
      expect(ERROR_CATALOG[code].status).toBeLessThan(600);
    }
  });

  it("모든 코드가 OpenAI 호환 type 3종 중 하나다", () => {
    const valid = ["invalid_request_error", "rate_limit_error", "api_error"];
    for (const code of CODES) {
      expect(valid).toContain(ERROR_CATALOG[code].type);
    }
  });

  // 문서 표는 카탈로그에서 생성되므로, meaning/fix가 비면 문서 행이 비게 된다.
  // → "코드만 추가하고 문서를 빼먹는" 실수를 여기서 잡는다(카탈로그↔문서 일치성).
  it("모든 코드가 비어있지 않은 meaning/fix(문서 메타)를 가진다", () => {
    for (const code of CODES) {
      expect(ERROR_CATALOG[code].meaning.length).toBeGreaterThan(0);
      expect(ERROR_CATALOG[code].fix.length).toBeGreaterThan(0);
    }
  });

  it("코드 이름은 domain_state 스네이크(소문자+언더스코어)다", () => {
    for (const code of CODES) {
      expect(code).toMatch(/^[a-z]+(_[a-z0-9]+)+$/);
    }
  });
});

describe("docUrlFor", () => {
  it("base + #code 형태", () => {
    expect(docUrlFor("relay_key_revoked")).toMatch(/\/docs#relay_key_revoked$/);
  });
});

describe("relayError — 응답 생성기", () => {
  it("카탈로그의 status/type을 그대로 쓰고 code/doc_url/request_id를 채운다", async () => {
    const res = relayError("relay_key_revoked", "Unknown or revoked Relay key", "req-123");
    expect(res.status).toBe(401); // 카탈로그값
    const body = await res.json();
    expect(body.error.code).toBe("relay_key_revoked");
    expect(body.error.type).toBe("invalid_request_error");
    expect(body.error.message).toBe("Unknown or revoked Relay key");
    expect(body.error.doc_url).toBe(docUrlFor("relay_key_revoked"));
    expect(body.error.request_id).toBe("req-123");
  });

  it("request_id는 본문과 X-Relay-Request-Id 헤더에 동일하게 실린다", async () => {
    const res = relayError("rate_limit_exceeded", "slow down", "req-xyz");
    expect(res.headers.get("X-Relay-Request-Id")).toBe("req-xyz");
    const body = await res.json();
    expect(body.error.request_id).toBe("req-xyz");
  });

  it("rate_limit_exceeded는 429 + rate_limit_error", async () => {
    const res = relayError("rate_limit_exceeded", "x", "r");
    expect(res.status).toBe(429);
    expect((await res.json()).error.type).toBe("rate_limit_error");
  });

  it("requestId 생략 시 헤더는 없지만 본문 request_id는 undefined로 존재", async () => {
    const res = relayError("invalid_json", "bad json");
    expect(res.headers.get("X-Relay-Request-Id")).toBeNull();
    const body = await res.json();
    expect(body.error.request_id).toBeUndefined();
  });
});
