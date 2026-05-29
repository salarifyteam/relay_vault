# @relayservice/sdk

Official SDK for **Relay** — BYOK AI infrastructure. Your users bring their own OpenAI / Anthropic / Google keys; **you never see them**. Relay stores keys encrypted and proxies AI calls on your users' behalf, metering usage and enforcing spend caps.

## Install

```bash
npm install @relayservice/sdk openai
```

`openai` is a peer dependency — chat & embeddings reuse the official OpenAI client, so there's **nothing new to learn**.

## Quickstart

```ts
import { Relay } from "@relayservice/sdk";

const relay = new Relay({ key: process.env.RELAY_KEY }); // your rly- key

// Call AI on behalf of one of your end-users — same code you already write with OpenAI:
const ai = relay.openai({ user: "jieun_123" });
const res = await ai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(res.choices[0].message.content);
```

That's it. The AI cost is billed to **your user's own key** — Relay just routes it.

## Onboarding a user (they connect their own key)

1. **Backend** — issue a short-lived registration token:

```ts
const { registrationToken } = await relay.createRegistrationToken({
  user: "jieun_123",
  // provider: "openai",   // optional — omit to let the user pick in the widget
});
```

2. **Frontend** — drop in the widget; the user pastes their key (it goes straight to Relay, never your server):

```html
<div id="relay-widget"></div>
<script src="https://vault.relayservice.im/widget.js"></script>
<script>
  Relay.mount('#relay-widget', { registrationToken });
</script>
```

Once connected, `relay.openai({ user: "jieun_123" })` works for that user.

## Embeddings

Same client, same idiomatic call:

```ts
const ai = relay.openai({ user: "jieun_123" });
const e = await ai.embeddings.create({
  model: "text-embedding-3-small",
  input: "search this",
});
```

Supported: OpenAI (`text-embedding-*`) and Google (`gemini-embedding-001`). Anthropic has no embeddings API.

## Streaming

```ts
const stream = await ai.chat.completions.create({
  model: "claude-haiku-4-5",   // Anthropic, Gemini, etc. — all OpenAI-compatible through Relay
  messages: [{ role: "user", content: "Write a haiku" }],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}
```

## Tracing a request

Every response carries a Relay request id — handy for support:

```ts
const { data, response } = await ai.chat.completions
  .create({ model: "gpt-4o-mini", messages })
  .withResponse();
console.log(response.headers.get("x-relay-request-id"));
```

## Free vs paid users

If you run a free tier on your own app, mark free users so Relay bills you only for paid ones:

```ts
const ai = relay.openai({ user: "guest_42", paid: false });
```

## Error handling

`createRegistrationToken` and `health` throw `RelayError` (with `.status` and `.requestId`):

```ts
import { RelayError } from "@relayservice/sdk";

try {
  await relay.createRegistrationToken({ user: "jieun_123" });
} catch (e) {
  if (e instanceof RelayError) console.error(e.status, e.message);
}
```

Chat/embeddings errors come from the OpenAI client (`APIError`), exactly as you'd expect.

## API

```ts
new Relay({ key, baseURL?, fetch? })
  .createRegistrationToken({ user, provider? }) → { registrationToken, expiresAt, submitUrl }
  .openai({ user, paid? })                      → configured OpenAI client
  .health()                                     → { status, db }
```

`baseURL` defaults to `https://vault.relayservice.im`; override it for self-hosting or testing.

## License

MIT
