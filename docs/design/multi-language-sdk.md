# Design: multi-language SDK (Python first)

Status: **proposed → building** (autonomous). Scope: priority (4) of the "Stripe-level DX" track.

## Goal

Offer the Relay SDK in more than just TypeScript. Start with **Python** (the largest AI-dev
audience after JS; official `openai` Python package exists). The Python SDK mirrors the TS SDK's
surface 1:1 so docs and mental model transfer.

## The key insight (from exploration)

Relay is an **OpenAI-compatible proxy**. The TS SDK is a *thin* wrapper:
- `createRegistrationToken()` — the **only** Relay-specific HTTP endpoint.
- `openai()` — just returns the official OpenAI client with `base_url` + Relay headers pre-set.
  chat/embeddings are handled entirely by the official OpenAI SDK.
- `health()` — `GET /api/health`.
- `RelayError` — parses `{ error: { message, code, doc_url, request_id } }`.

So the Python SDK does NOT reimplement chat/embeddings. It mirrors exactly these four things.
The "contract" to port is the HTTP behavior of `registration-tokens` + the header convention
(`Authorization: Bearer rly_...`, `X-Relay-User`, `X-Relay-Paid`) + the error shape.

## Python SDK surface (mirror of TS)

Package `relay` (dir `packages/sdk-python/`).

```python
from relay import Relay, RelayError

relay = Relay(key="rly_live_...")                  # baseURL optional, default vault.relayservice.im

# 1. Registration token (the Relay-specific call)
tok = relay.create_registration_token(user="alice", provider="openai")  # provider optional
# tok.registration_token, tok.expires_at, tok.submit_url

# 2. OpenAI client pre-bound to an end-user (official openai package, base_url + headers set)
client = relay.openai(user="alice", paid=True)     # returns openai.OpenAI
client.chat.completions.create(model="gpt-4o-mini", messages=[...])

# 3. Health
h = relay.health()                                  # h.status, h.db

# Errors
try:
    relay.create_registration_token(user="alice")
except RelayError as e:
    if e.code == "relay_key_revoked":               # stable code (priority 2)
        ...
    # e.status, e.code, e.request_id, e.doc_url
```

### Mapping TS → Python

| TS | Python | Notes |
|----|--------|-------|
| `new Relay({ key, baseURL })` | `Relay(key=..., base_url=...)` | snake_case kwargs |
| `createRegistrationToken({user, provider})` | `create_registration_token(user=..., provider=...)` | |
| `relay.openai({user, paid})` | `relay.openai(user=..., paid=...)` | returns `openai.OpenAI` |
| `relay.health()` | `relay.health()` | |
| `RelayError.{status,code,requestId,docUrl}` | `RelayError.{status,code,request_id,doc_url}` | snake_case attrs |

## HTTP contract to implement (the only hand-written HTTP)

`create_registration_token`:
- `POST {base_url}/v1/registration-tokens`
- headers: `Content-Type: application/json`, `Authorization: Bearer {key}`
- body: `{"endUserLabel": user, "provider": provider_or_omitted}`
- 2xx → parse `{registrationToken, expiresAt, submitUrl}`
- non-2xx → raise `RelayError` from `{error:{message,code,doc_url,request_id}}` (+ `X-Relay-Request-Id` header)

`health`:
- `GET {base_url}/api/health` → `{status, db}`

`openai(user, paid)`:
- `return openai.OpenAI(api_key=key, base_url=f"{base_url}/v1", default_headers={"X-Relay-User": user, **({"X-Relay-Paid":"false"} if paid is False else {})})`
- exactly mirrors TS: only send `X-Relay-Paid` when opting out.

## Implementation choices

- **HTTP lib**: `httpx` (modern, sync+async friendly) OR stdlib `urllib`. To keep deps minimal and
  avoid forcing a transitive dep, use stdlib `urllib.request` for the two tiny calls
  (registration-token, health). `openai` is the only hard dependency (peer).
- **openai dependency**: declared as a dependency (the official package). `relay.openai()` imports
  it lazily so importing `relay` doesn't hard-require openai at import time (parity with how TS
  imports it at the top — but lazy import is friendlier for users who only want tokens).
- **Types**: dataclasses for results (`RegistrationToken`, `Health`). Type hints throughout.
- **Python version**: 3.9+ (broad compatibility).

## Package layout

```
packages/sdk-python/
  pyproject.toml          # name "relay-sdk", deps: openai; py>=3.9
  README.md               # quickstart mirroring TS docs
  src/relay/
    __init__.py           # exports Relay, RelayError, result dataclasses
    client.py             # Relay class
    errors.py             # RelayError + _raise_for_response
  tests/
    test_client.py        # unit: header convention, error parsing, openai() factory
```

The repo root stays npm-centric; the Python package is self-contained under `packages/`
(no workspace coupling — it builds/tests with Python tooling).

## Tests (no live server needed)

Mirror the TS SDK's unit intent, using a fake transport:
- `create_registration_token` sends the right method/URL/headers/body (capture via a stub opener).
- error response → `RelayError` with `.code`/`.status`/`.request_id`/`.doc_url` populated.
- non-JSON / code-less error still raises with sensible defaults.
- `openai()` builds an `openai.OpenAI` with `base_url` and `X-Relay-User` header; `paid=False`
  adds `X-Relay-Paid: false`, default omits it. (Assert on the constructed client's config; skip
  if `openai` not installed in the test env.)
- constructor requires `key`.

## Out of scope

- Other languages (Go/Java) — follow-up; this establishes the porting pattern.
- Async API (`AsyncRelay`) — follow-up; sync first.
- Publishing to PyPI — packaging metadata is included, actual publish is a release step.
- Reimplementing chat/embeddings — intentionally delegated to the official `openai` package.
