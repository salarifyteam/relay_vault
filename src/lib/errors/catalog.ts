// v1(SDK 대면) API의 안정적 에러 코드 단일 출처(single source of truth).
// 순수 데이터 모듈 — NextResponse 등 서버 전용 의존성 없음(클라이언트 docs 페이지에서도 import 가능).
// 응답 생성기 relayError()는 @/lib/errors/relayError 에 분리돼 있다.
// 모든 v1 에러는 여기 정의된 code로만 나간다. 각 항목이 status/type(응답)과
// meaning/fix(문서)를 함께 들고 있어, 응답과 docs 레퍼런스가 절대 어긋나지 않는다.
//
// 네이밍: domain_state 스네이크 (relay_key_revoked 등). Stripe 스타일.
// type: OpenAI 호환 버킷(확장하지 않음). 세분화 축은 code다.

// OpenAI 호환 에러 버킷. 이 집합은 확장하지 않는다.
export type ErrorType = "invalid_request_error" | "rate_limit_error" | "api_error";

interface CatalogEntry {
  status: number;
  type: ErrorType;
  // 사람용 문서 메타(영어). docs 레퍼런스 표가 이걸 그대로 쓴다. 메시지는 호출 지점에서 따로 넘긴다.
  meaning: string;
  fix: string;
}

// code → { status, type, meaning, fix }. 18개. 묶음 순서대로.
export const ERROR_CATALOG = {
  // ── 요청 검증 ──
  invalid_json: {
    status: 400, type: "invalid_request_error",
    meaning: "The request body is not valid JSON.",
    fix: "Send a well-formed JSON body with the correct Content-Type.",
  },
  model_missing: {
    status: 400, type: "invalid_request_error",
    meaning: "The request body has no 'model' field.",
    fix: "Include a 'model' string in the request body.",
  },
  model_unknown: {
    status: 400, type: "invalid_request_error",
    meaning: "The model name does not map to any supported provider.",
    fix: "Use a supported model name. See the model list in the docs.",
  },
  input_missing: {
    status: 400, type: "invalid_request_error",
    meaning: "The embeddings request has no valid 'input'.",
    fix: "Provide 'input' as a string or array of strings.",
  },
  embeddings_unsupported: {
    status: 400, type: "invalid_request_error",
    meaning: "Embeddings are not available for the chosen provider/model.",
    fix: "Use an embedding-capable model (Anthropic has no embeddings API).",
  },
  user_header_missing: {
    status: 400, type: "invalid_request_error",
    meaning: "The X-Relay-User header is missing.",
    fix: "Send X-Relay-User with the end-user's label on every proxied call.",
  },
  request_too_large: {
    status: 413, type: "invalid_request_error",
    meaning: "The request body exceeds the 1MB limit.",
    fix: "Reduce the request size (e.g. fewer/smaller messages).",
  },
  provider_invalid: {
    status: 400, type: "invalid_request_error",
    meaning: "The provider value is not one Relay supports.",
    fix: "Use one of: openai, google, anthropic, xai, zai.",
  },
  enduser_label_missing: {
    status: 400, type: "invalid_request_error",
    meaning: "The request has no endUserLabel.",
    fix: "Include endUserLabel when requesting a registration token.",
  },

  // ── 인증 / 키 ──
  relay_key_invalid: {
    status: 401, type: "invalid_request_error",
    meaning: "The Authorization header is missing or not a Relay key.",
    fix: "Send 'Authorization: Bearer rly_...' with a valid key.",
  },
  relay_key_revoked: {
    status: 401, type: "invalid_request_error",
    meaning: "The Relay key is unknown or has been revoked.",
    fix: "Create a new key in the console and replace the old one.",
  },
  relay_tenant_disabled: {
    status: 401, type: "invalid_request_error",
    meaning: "The key is valid but its project/tenant is disabled.",
    fix: "Check your account status or contact support.",
  },
  enduser_key_missing: {
    status: 404, type: "invalid_request_error",
    meaning: "No usable BYOK key is registered for this end-user.",
    fix: "Have the end-user connect a key via the widget first.",
  },

  // ── 한도 / 정책 ──
  rate_limit_exceeded: {
    status: 429, type: "rate_limit_error",
    meaning: "Too many requests this minute for your plan.",
    fix: "Slow down and retry after the Retry-After header.",
  },
  active_key_limit: {
    status: 429, type: "rate_limit_error",
    meaning: "The Free plan's active end-user-key limit is reached.",
    fix: "Upgrade your plan to add more end-user keys.",
  },
  spend_cap_exceeded: {
    status: 429, type: "invalid_request_error",
    meaning: "The end-user (or tenant default) spend cap is reached.",
    fix: "Raise the spend cap in the console, or wait for the next cycle.",
  },

  // ── 내부 오류 ──
  key_decrypt_failed: {
    status: 500, type: "api_error",
    meaning: "Relay could not decrypt the stored end-user key.",
    fix: "Transient/internal — retry; if it persists, contact support.",
  },
} as const satisfies Record<string, CatalogEntry>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

// doc_url의 베이스. 기존 컨벤션(APP_BASE_URL → 공개 도메인 폴백)과 일치.
const DOCS_BASE = `${process.env.APP_BASE_URL || "https://relayservice.im"}/docs`;

export function docUrlFor(code: ErrorCode): string {
  return `${DOCS_BASE}#${code}`;
}
