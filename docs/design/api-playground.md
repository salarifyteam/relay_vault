# Design: API test console (Playground)

Status: **proposed → building** (autonomous). Scope: priority (3) of the "Stripe-level DX" track.

## Goal

An in-console **API Playground** (like Stripe's API Explorer / OpenAI Playground): the developer
picks an endpoint, fills in inputs, hits "Send", and sees the real Relay response — without
leaving the dashboard or copy-pasting curl. Interactive, real calls, real responses (incl. the
new error codes from priority 2).

## The key constraint that shapes everything

The browser **cannot call `/api/v1/*` directly**, for two independent reasons:
1. v1 routes emit **no CORS headers** (server-to-server by design).
2. We **hash keys** (priority 1) — the browser has no plaintext key to send as `Authorization`.

**Resolution: server-proxied calls.** The Playground UI (browser) posts the *intent* of a call
(endpoint + body + end-user label) to a new **session-authenticated** console route. That route:
- authenticates via the session cookie (`getCurrentDeveloper()`),
- mints/uses a key server-side for the active tenant,
- calls the v1 endpoint internally,
- returns the response to the browser.

The API key **never reaches the browser.** This is the safest model and the only one compatible
with hashed keys.

## Security decision: which environment, which key

The Playground proxy uses a **test-environment** key, **minted per request and revoked
immediately after**:
- Because keys are hashed (priority 1), the plaintext secret cannot be recovered after minting —
  so a long-lived "reused" playground key is impossible. Instead, each playground call mints a
  fresh `test` key (name `playground`), uses its plaintext in-memory for the single internal v1
  call, then revokes it in a `finally`. Net DB effect: a short-lived, revoked `ApiKey` row.
- This is actually *more* secure than a reused key: no playground key is ever active longer than
  one request, and no plaintext is persisted or returned to the browser.
- The Playground is **test-only** in this slice. Live calls (real spend, real rate-limit budget)
  are intentionally not exposed from a one-click UI. The UI shows a note: "Playground runs in
  **test** mode."
- Rationale: a test-mode playground can't cause surprise spend or live rate-limit consumption,
  and test/live isolation (priority 1) already guarantees it can't see live data.

> Live-mode playground is a deliberate follow-up (needs an explicit "I understand this is real"
> confirm). Out of scope here.

## What you can test (this slice)

Three v1 endpoints, matching the SDK surface:

| Endpoint | Inputs in UI | Notes |
|----------|--------------|-------|
| `POST /v1/chat/completions` | model (select), end-user label, messages (textarea JSON or simple prompt) | non-streaming only in this slice (streaming = follow-up) |
| `POST /v1/embeddings` | model (select), end-user label, input (textarea) | |
| `POST /v1/registration-tokens` | end-user label, provider (select, optional) | no end-user key needed |

For chat/embeddings the call needs an **end-user with a registered BYOK key** in test mode.
The UI surfaces this clearly: if the response is `enduser_key_missing` (404), we show the
fix from the error catalog ("have the end-user connect a key via the widget"). This is honest —
the Playground exercises the *real* pipeline, including the BYOK requirement.

## Server route

New: `POST /api/console/playground` (session-auth, `requireRole(me, "member")`).

Request body:
```ts
{
  endpoint: "chat" | "embeddings" | "registration-token",
  endUserLabel?: string,          // required for chat/embeddings
  body: unknown,                  // the JSON to forward (messages/input/model, etc.)
  provider?: string,              // for registration-token
}
```

Behavior:
1. `getCurrentDeveloper()` → 401 if not authed; `requireRole(me, "member")`.
2. Resolve the tenant's `playground` test key (mint if absent) → plaintext secret (in-memory only).
3. Build an internal `fetch` to the matching v1 route on the same origin, with
   `Authorization: Bearer <secret>`, `X-Relay-User: <label>`, `Content-Type: application/json`.
4. Forward status + body back to the browser verbatim (so the UI sees the real error codes).
5. Also return the `X-Relay-Request-Id` so the UI can show it.

> We call our own v1 route over HTTP (same origin) rather than importing its handler, so the
> Playground exercises the identical path real SDK traffic takes (auth, rate limit, governance,
> metering). The origin is derived from the request (`new URL(req.url).origin`).

## UI

- New page `src/app/console/playground/page.tsx` (server component, standard pattern:
  `getCurrentDeveloper` → `redirect("/login")` → `Shell`).
- Client component `PlaygroundClient.tsx`: endpoint tabs, inputs, "Send", response panel.
- New nav item in `Shell.tsx` `NAV`: `{ href: "/console/playground", label: "Playground", icon: Zap }`.
- New small UI primitives in `ui.tsx`: `Select`, `Textarea`, `Field` (label+control wrapper) —
  the audit confirmed these don't exist yet. Keep them minimal, matching the existing inline
  `<input>` style used in SpendCapEditor/OriginsEditor.
- Response panel reuses `CodeBlock` for JSON; an error renders a compact box showing
  `code`, `message`, `request_id`, and a `doc_url` link (the priority-2 fields).

## Out of scope (explicitly)

- Streaming responses (SSE) in the UI — follow-up.
- Live-mode calls — follow-up (needs explicit confirm).
- Saving/replaying requests, history — follow-up.
- Non-v1 (console) endpoints.

## Verification

- Unit: the playground route resolves/mint logic (mints a `playground` test key once, reuses it).
- Integration: POST `/api/console/playground` with a session → for `registration-token` returns a
  token; for `chat` without a BYOK key returns the forwarded `enduser_key_missing` (404) **with
  its error code intact** (proves the proxy forwards verbatim).
- Build: `next build` compiles the new page/route; nav renders.
- Keep full suite green.
