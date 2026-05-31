# Relay Python SDK

BYOK AI infrastructure for Python. Mirrors the [TypeScript SDK](../sdk).

Relay is an **OpenAI-compatible proxy**, so chat/embeddings go through the official `openai`
package — Relay just pre-sets the base URL and headers. The only Relay-specific call is issuing a
**registration token** (so your end-users can connect their own AI keys).

## Install

```bash
pip install relay-sdk
```

## Quickstart

```python
from relay import Relay, RelayError

relay = Relay(key="rly_live_...")  # your Relay key (from the console)

# 1) Backend: issue a single-use token so a user can connect their key
tok = relay.create_registration_token(user="alice")        # provider optional
print(tok.registration_token)  # hand this to your frontend widget

# 2) Make AI calls on behalf of that user (official openai client, pre-bound)
client = relay.openai(user="alice")
resp = client.chat.completions.create(
    model="gpt-4o-mini",                                   # gpt-* → OpenAI, claude-* → Anthropic, gemini-* → Google
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.choices[0].message.content)

# Embeddings work the same way
emb = client.embeddings.create(model="text-embedding-3-small", input="search this")
```

## Errors

Every error carries a **stable `code`** — branch on it, not the human message.

```python
try:
    relay.create_registration_token(user="alice")
except RelayError as e:
    if e.code == "relay_key_revoked":
        ...  # rotate your key
    print(e.status, e.code, e.request_id, e.doc_url)
```

See the [error code reference](https://relayservice.im/docs#errors).

## API

| Method | Description |
|--------|-------------|
| `Relay(key, base_url=...)` | Create a client. `base_url` defaults to `https://vault.relayservice.im`. |
| `create_registration_token(user, provider=None)` | Issue a single-use key-connect token. Returns `RegistrationToken(registration_token, expires_at, submit_url)`. |
| `openai(user, paid=True)` | Return an official `openai.OpenAI` pre-bound to an end-user (sets base URL + `X-Relay-User`[, `X-Relay-Paid`]). |
| `health()` | Service status. Returns `Health(status, db)`. |

`RelayError` exposes `.message`, `.status`, `.code`, `.request_id`, `.doc_url`.

## Develop

```bash
cd packages/sdk-python
pip install -e ".[dev]" pytest openai
pytest
```
