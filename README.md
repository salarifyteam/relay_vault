# Relay

> **Work in progress / prototype stage** — feedback welcome.

BYOK (Bring Your Own Key) AI infrastructure. Let your users plug in their own OpenAI, Anthropic, or Google API keys — you proxy the requests, enforce quotas, and never store the raw keys.

## What problem does it solve?

SaaS products that want to offer AI features face a choice: absorb API costs yourself, or ask users to paste a key into a text box and hope for the best. Relay is a middle path — users register their keys once through a secure widget, and your backend routes calls through Relay without ever seeing the plaintext key.

## How it works

1. User opens the **key registration widget** (embeddable iframe) and enters their API key.
2. Relay encrypts and stores the key, returning an opaque `relay_key` token.
3. Your backend uses the `relay_key` when calling OpenAI/Anthropic/Google — Relay decrypts on the fly and forwards the request.
4. The **console** shows per-tenant usage, active keys, billing, and team members.

## Running locally

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env.local
# fill in MONGODB_URI, ENCRYPTION_KEY, etc.

# 3. Start dev server
npm run dev
```

App runs at `http://localhost:3000`.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **MongoDB** — tenant/key storage
- **Web Crypto API** — client-side key sealing
- `@relayservice/sdk` — thin npm package for backend integration

## SDK

```ts
import { RelayClient } from "@relayservice/sdk";

const relay = new RelayClient({ apiKey: "YOUR_RELAY_PUBLISHABLE_KEY" });
const response = await relay.chat({ relayKey: userRelayKey, messages: [...] });
```

## License

MIT
