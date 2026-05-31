# Design: stable error codes + reference (v1 API)

Status: **proposed** — awaiting sign-off before implementation.
Owner: backend + SDK + docs. Scope: priority (2) of the "Stripe-level DX" track.

## Goal

Give every error the v1 (SDK-facing) API returns a **stable machine-readable `code`**, plus a
`doc_url` and `request_id`, and publish a **reference page** documenting each code (what it
means, why it happens, how to fix it). Like Stripe's error codes. Today the only way to tell two
errors apart is the human English `message`, which forces brittle `message.includes(...)`
parsing.

## Decisions (locked with product)

1. **Scope = v1 (SDK-facing) API only.** `chat/completions`, `embeddings`,
   `registration-tokens`. ~20 distinct errors. Console APIs (session-based, web-UI-only) and
   widget/OAuth are out of scope for this slice. `registration-tokens` (currently raw
   `NextResponse.json`) is unified onto `oaiError`.
2. **Naming = `domain_state` snake_case.** `relay_key_revoked`, `enduser_key_missing`,
   `rate_limit_exceeded`, `model_unknown`. Stripe-style, flat, greppable.
3. **OpenAI-compatible.** Relay is a drop-in OpenAI proxy; `oaiError` deliberately mirrors
   OpenAI's `{ error: { message, type } }`. OpenAI's own error object *has* a `code` field, so
   our `code` slots in natively. `doc_url` + `request_id` are Relay extensions (OpenAI SDKs
   ignore unknown fields — safe).

## Response shape

Current `oaiError` → `{ error: { message, type } }`. New:

```jsonc
{
  "error": {
    "message": "Unknown or revoked Relay key",   // human, may change
    "type": "invalid_request_error",              // OpenAI bucket (unchanged set)
    "code": "relay_key_revoked",                  // ← NEW: stable, the thing you branch on
    "doc_url": "https://relayservice.im/docs#relay_key_revoked",  // ← NEW
    "request_id": "req_abc123"                    // ← NEW: mirrors X-Relay-Request-Id header
  }
}
```

- `type` stays the existing OpenAI bucket (`invalid_request_error` | `rate_limit_error` |
  `api_error`). We do **not** expand it — `code` is the granular axis.
- `request_id` duplicates the `X-Relay-Request-Id` header into the body so SDK users who only
  log the body still get it. Same value as the header.
- `doc_url` is derived: `${DOCS_BASE}#${code}`. One base const.

## The code catalog (single source of truth)

A new module `src/lib/errors/catalog.ts` is the **one place** every v1 error is defined:

```ts
// code → { status, type, doc anchor }. message is passed at the call site (may be dynamic).
export const ERROR_CATALOG = {
  // ── request validation ──
  invalid_json:            { status: 400, type: "invalid_request_error" },
  model_missing:           { status: 400, type: "invalid_request_error" },
  model_unknown:           { status: 400, type: "invalid_request_error" },
  input_missing:           { status: 400, type: "invalid_request_error" },
  embeddings_unsupported:  { status: 400, type: "invalid_request_error" },
  user_header_missing:     { status: 400, type: "invalid_request_error" },  // X-Relay-User
  request_too_large:       { status: 413, type: "invalid_request_error" },
  provider_invalid:        { status: 400, type: "invalid_request_error" },  // registration-tokens
  enduser_label_missing:   { status: 400, type: "invalid_request_error" },  // registration-tokens

  // ── auth / keys ──
  relay_key_invalid:       { status: 401, type: "invalid_request_error" },  // bad/missing format
  relay_key_revoked:       { status: 401, type: "invalid_request_error" },  // unknown or revoked
  relay_tenant_disabled:   { status: 401, type: "invalid_request_error" },  // tenant !active
  enduser_key_missing:     { status: 404, type: "invalid_request_error" },  // no BYOK for user

  // ── quota / governance ──
  rate_limit_exceeded:     { status: 429, type: "rate_limit_error" },
  active_key_limit:        { status: 429, type: "rate_limit_error" },       // Free hard cap
  spend_cap_exceeded:      { status: 429, type: "invalid_request_error" },  // governance gate

  // ── internal ──
  key_decrypt_failed:      { status: 500, type: "api_error" },
} as const;

export type ErrorCode = keyof typeof ERROR_CATALOG;
```

> Note the mapping from today's errors → codes covers the v1 error sites the audit found
> (17 distinct codes). The `gate.reason` governance path (currently a free string) collapses
> into `spend_cap_exceeded` (the only gate today); proxyCommon uses that as the fallback code
> when a gate blocks without naming its own code.

### `relayError(code, message?, requestId)` helper

`oaiError(message, status, type, requestId)` is **replaced** at v1 call sites by:

```ts
export function relayError(code: ErrorCode, message: string, requestId?: string): NextResponse {
  const { status, type } = ERROR_CATALOG[code];
  const headers: Record<string, string> = {};
  if (requestId) headers["X-Relay-Request-Id"] = requestId;
  return NextResponse.json(
    { error: { message, type, code, doc_url: `${DOCS_BASE}#${code}`, request_id: requestId } },
    { status, headers }
  );
}
```

- `message` stays at the call site (it's often dynamic: `No usable ${provider} key…`). The
  **code** is fixed; the message is free to change. That's the whole point.
- `oaiError` is kept as a thin internal wrapper for any non-catalog edge (or deleted if no
  caller remains — TBD during impl).
- Status/type now come from the catalog, so a call site **cannot** drift status/type away from
  the documented contract. Single source of truth enforced by the type system.

## Call-site changes (v1 only)

| File | sites | change |
|------|-------|--------|
| `src/lib/proxyCommon.ts` | 9 | each `oaiError(...)` → `relayError("<code>", message, requestId)` |
| `src/app/api/v1/chat/completions/route.ts` | 3 | same |
| `src/app/api/v1/embeddings/route.ts` | 5 | same |
| `src/app/api/v1/registration-tokens/route.ts` | 6 | switch from `NextResponse.json` → `relayError` (now carries code + request id; it didn't before) |
| `src/lib/governance/checkRequest.ts` | 1 | gate returns a `code` alongside reason; proxyCommon maps it |

The governance `CheckResult` gains an optional `code?: ErrorCode` so the gate names its own
error instead of proxyCommon guessing from status.

## SDK changes (`packages/sdk`)

`RelayError` gains `.code`:

```ts
export class RelayError extends Error {
  readonly status: number;
  readonly code?: string;       // ← NEW
  readonly requestId?: string;
  readonly docUrl?: string;     // ← NEW (optional convenience)
  constructor(message, status, opts?: { code?: string; requestId?: string; docUrl?: string }) { … }
}
```

`toRelayError` reads `body.error.code` / `body.error.doc_url`. **Back-compat:** the constructor
keeps working positionally for `(message, status, requestId)` callers via an overload, OR we
migrate the one internal caller — impl detail. SDK users can now write
`if (err.code === "relay_key_revoked") …`.

> The OpenAI client path (chat/embeddings via the OpenAI SDK) is unaffected — those throw the
> OpenAI client's own errors, which already surface `error.code`. Our `code` values appear there
> too because we put them in the response body the OpenAI client parses.

## Docs reference page

The public docs page already has an `errors` section slot
([src/app/docs/page.tsx:252](../../src/app/docs/page.tsx#L252)) — currently just prose. We add a
**reference table**, one row per code, with stable `id="<code>"` anchors so `doc_url` deep-links
land on the row.

Table columns: **Code · HTTP · Meaning · How to fix**. Grouped by category (validation, auth/keys,
quota, internal). The table is **generated from the catalog** (a small const array of
`{ code, meaning, fix }` co-located with or derived from `ERROR_CATALOG`) so docs can't drift
from the actual statuses/types — the HTTP/type columns read straight from `ERROR_CATALOG`.

Same content also lands in the console docs (`DocsContent.tsx`) if cheap, but public docs is the
canonical home (it's where `doc_url` points). The console copy is optional/nice-to-have.

## Out of scope (explicitly)

- Console API error codes (session-based, web-UI-only) — they keep `{ error: { message } }`.
- Widget `{ ok: false, error }` shape — unchanged (separate CORS client).
- OAuth redirect errors (`?error=bad_state`) — unchanged.
- Expanding the OpenAI `type` set — we only add `code`.
- i18n of messages — messages stay English.

## Verification plan

- Unit: `relayError(code, msg, reqId)` returns the catalog's status/type, body has
  `code` + `doc_url` (= `DOCS_BASE#code`) + `request_id`, and the `X-Relay-Request-Id` header
  equals `request_id`.
- Unit: every `ErrorCode` in the catalog has a corresponding docs row (catalog ↔ reference
  completeness — fails if a code is added without documenting it).
- Integration: hit the v1 auth failures (revoked key, disabled tenant, missing user header,
  rate limit) through `authenticateAndAuthorize` and assert the exact `code` per case — including
  the three previously-indistinguishable 401s now carrying distinct codes
  (`relay_key_invalid` / `relay_key_revoked` / `relay_tenant_disabled`).
- SDK: `toRelayError` populates `.code`/`.docUrl` from the body; positional back-compat holds.
- Keep the full existing suite green (102 tests).
