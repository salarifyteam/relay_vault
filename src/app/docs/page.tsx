import Link from "next/link";
import { CodeBlock } from "@/components/ui";
import s from "./docs.module.css";

export const metadata = {
  title: "Relay Docs — BYOK AI infrastructure",
  description:
    "Let your users bring their own OpenAI / Anthropic / Google keys. You never see them. Add BYOK to your app in minutes.",
};

const NAV = [
  { id: "quickstart", label: "Quickstart" },
  { id: "sdk", label: "SDK" },
  { id: "tokens", label: "Registration tokens" },
  { id: "widget", label: "Key widget" },
  { id: "calling", label: "Calling AI" },
  { id: "embeddings", label: "Embeddings" },
  { id: "errors", label: "Errors & tracing" },
  { id: "reference", label: "API reference" },
];

export default function PublicDocs() {
  return (
    <div className={s.page}>
      <header className={s.topbar}>
        <div className={s.brand}>Relay</div>
        <nav className={s.topnav}>
          <Link href="/login">Console</Link>
        </nav>
      </header>

      <div className={s.layout}>
        <aside className={s.sidebar}>
          <div className={s.sideTitle}>Documentation</div>
          <ul>
            {NAV.map((n) => (
              <li key={n.id}>
                <a href={`#${n.id}`}>{n.label}</a>
              </li>
            ))}
          </ul>
        </aside>

        <main className={s.content}>
          <h1 className={s.h1}>Relay — BYOK AI infrastructure</h1>
          <p className={s.lead}>
            Your users bring their own OpenAI / Anthropic / Google API keys.{" "}
            <strong>You never see them.</strong> Relay stores keys encrypted and proxies AI
            calls on each user&apos;s behalf — so you can offer AI without paying for everyone&apos;s tokens.
          </p>

          <section id="quickstart" className={s.section}>
            <h2 className={s.h2}>Quickstart</h2>
            <p className={s.p}>Install the SDK and the official OpenAI client:</p>
            <CodeBlock>{`npm install @relayservice/sdk openai`}</CodeBlock>
            <p className={s.p}>Call AI on behalf of one of your users — the same code you already write with OpenAI:</p>
            <CodeBlock>{`import { Relay } from "@relayservice/sdk";

const relay = new Relay({ key: process.env.RELAY_KEY }); // your rly- key

const ai = relay.openai({ user: "jieun_123" });
const res = await ai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }],
});`}</CodeBlock>
            <p className={s.note}>
              Get your <code>rly-</code> key from the{" "}
              <Link href="/login">Relay console</Link>.
            </p>
          </section>

          <section id="sdk" className={s.section}>
            <h2 className={s.h2}>SDK</h2>
            <p className={s.p}>
              The SDK has two parts: a small Relay-specific method for onboarding users, and a
              pre-configured OpenAI client for AI calls (so there&apos;s nothing new to learn).
            </p>
            <CodeBlock>{`const relay = new Relay({ key: "rly-..." });

// Relay-specific: issue a token so a user can connect their key
await relay.createRegistrationToken({ user: "jieun_123" });

// AI calls: a normal OpenAI client, bound to that user
const ai = relay.openai({ user: "jieun_123" });`}</CodeBlock>
          </section>

          <section id="tokens" className={s.section}>
            <h2 className={s.h2}>Registration tokens (your backend)</h2>
            <p className={s.p}>
              When a user wants to connect their key, ask Relay for a short-lived, single-use
              token. Omit <code>provider</code> to let the user pick (OpenAI / Anthropic / Google)
              in the widget, or set it to lock one provider.
            </p>
            <CodeBlock>{`const { registrationToken } = await relay.createRegistrationToken({
  user: "jieun_123",
  // provider: "openai",  // optional
});`}</CodeBlock>
            <p className={s.p}>Or call the HTTP API directly:</p>
            <CodeBlock>{`curl -X POST https://vault.relayservice.im/v1/registration-tokens \\
  -H "Authorization: Bearer rly-..." \\
  -H "Content-Type: application/json" \\
  -d '{"endUserLabel":"jieun_123"}'`}</CodeBlock>
          </section>

          <section id="widget" className={s.section}>
            <h2 className={s.h2}>Key widget (your frontend)</h2>
            <p className={s.p}>
              Drop in the widget. The user pastes their key — it goes straight to Relay over TLS,
              never your server. The widget renders in a Shadow DOM (your CSS can&apos;t break it),
              is responsive, and themeable.
            </p>
            <CodeBlock>{`<div id="relay-widget"></div>
<script src="https://vault.relayservice.im/widget.js"></script>
<script>
  Relay.mount('#relay-widget', {
    registrationToken,        // from your backend
    theme: 'light',           // 'light' | 'dark'
    accentColor: '#635bff',
    locale: 'en',             // 'en' | 'ko'
    onSuccess: (r) => console.log('connected', r.provider),
  });
</script>`}</CodeBlock>
            <p className={s.note}>
              On native apps, show a WebView pointing at a page that mounts the widget.
            </p>
          </section>

          <section id="calling" className={s.section}>
            <h2 className={s.h2}>Calling AI</h2>
            <p className={s.p}>
              Once a user has connected a key, use the OpenAI client for that user. The model name
              picks the provider — <code>gpt-*</code>, <code>claude-*</code>, <code>gemini-*</code> —
              and Relay translates everything to OpenAI format.
            </p>
            <CodeBlock>{`const ai = relay.openai({ user: "jieun_123" });

// streaming works too
const stream = await ai.chat.completions.create({
  model: "claude-haiku-4-5",
  messages: [{ role: "user", content: "Write a haiku" }],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}`}</CodeBlock>
          </section>

          <section id="embeddings" className={s.section}>
            <h2 className={s.h2}>Embeddings</h2>
            <p className={s.p}>Same client. OpenAI (<code>text-embedding-*</code>) and Google (<code>gemini-embedding-001</code>) are supported.</p>
            <CodeBlock>{`const e = await ai.embeddings.create({
  model: "text-embedding-3-small",
  input: "search this",
});`}</CodeBlock>
          </section>

          <section id="errors" className={s.section}>
            <h2 className={s.h2}>Errors & tracing</h2>
            <p className={s.p}>
              Every response carries a Relay request id — useful for support. The SDK&apos;s token
              methods throw <code>RelayError</code> (with <code>.status</code> and <code>.requestId</code>);
              AI calls throw the OpenAI client&apos;s errors.
            </p>
            <CodeBlock>{`const { data, response } = await ai.chat.completions
  .create({ model: "gpt-4o-mini", messages })
  .withResponse();
console.log(response.headers.get("x-relay-request-id"));`}</CodeBlock>
          </section>

          <section id="reference" className={s.section}>
            <h2 className={s.h2}>API reference</h2>
            <table className={s.table}>
              <thead>
                <tr><th>Method & path</th><th>Auth</th><th>Purpose</th></tr>
              </thead>
              <tbody>
                <tr><td className={s.mono}>POST /v1/registration-tokens</td><td>Bearer rly-</td><td>Issue a key-connect token</td></tr>
                <tr><td className={s.mono}>POST /v1/chat/completions</td><td>Bearer rly- + X-Relay-User</td><td>Chat (OpenAI-compatible)</td></tr>
                <tr><td className={s.mono}>POST /v1/embeddings</td><td>Bearer rly- + X-Relay-User</td><td>Embeddings</td></tr>
                <tr><td className={s.mono}>GET /api/health</td><td>—</td><td>Service status</td></tr>
              </tbody>
            </table>
            <p className={s.note}>Base URL: <code>https://vault.relayservice.im</code>. Set <code>X-Relay-Paid: false</code> to mark a free-tier user.</p>
          </section>

          <footer className={s.footer}>
            <span>Secured by Relay</span>
            <Link href="/login">Open console →</Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
