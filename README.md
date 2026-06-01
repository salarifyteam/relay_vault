# Relay

> **Work in progress / prototype stage** — feedback welcome.

BYOK (Bring Your Own Key) AI infrastructure. Let your users connect their own OpenAI, Anthropic, or Google API keys — you proxy the requests, enforce quotas, and never see the raw keys.

**Live:** [vault.relayservice.im](https://vault.relayservice.im) · [Docs](https://vault.relayservice.im/docs)

## What problem does it solve?

SaaS products that want to offer AI features face a choice: absorb API costs yourself, or ask users to paste a key into a text box and hope for the best. Relay is a middle path — users register their keys once through a secure widget, and your backend routes AI calls through Relay without ever seeing the plaintext key.

## How it works

1. Your backend asks Relay for a short-lived **registration token** for the current user.
2. User opens the **key widget** (embeddable, Shadow DOM) and enters their API key — it goes straight to Relay over TLS, never your server.
3. Your backend uses `relay.openai({ user })` to make AI calls on that user's behalf — Relay decrypts and forwards.
4. The **console** shows per-tenant usage, active keys, billing, and team members.

## Quickstart

```bash
npm install @relayservice/sdk openai
```

```ts
import { Relay } from "@relayservice/sdk";

const relay = new Relay({ key: process.env.RELAY_KEY });

// Issue a token so a user can connect their key
const { registrationToken } = await relay.createRegistrationToken({ user: userId });

// Make AI calls on their behalf
const ai = relay.openai({ user: userId });
const res = await ai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }],
});
```

The model name picks the provider automatically — `gpt-*` → OpenAI, `claude-*` → Anthropic, `gemini-*` → Google.

Get your `rly-` key from the [console](https://vault.relayservice.im).

## Docs

Full integration guide, widget setup, API reference, and error codes: [vault.relayservice.im/docs](https://vault.relayservice.im/docs)

## License

MIT
