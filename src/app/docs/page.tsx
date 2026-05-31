"use client";

import Link from "next/link";
import { useState } from "react";
import { CodeBlock } from "@/components/ui";
import { ERROR_CATALOG, type ErrorCode } from "@/lib/errors/catalog";
import s from "./docs.module.css";

// 에러 코드 레퍼런스 행 — 카탈로그에서 직접 생성하므로 응답과 절대 어긋나지 않는다.
const ERROR_ROWS = (Object.keys(ERROR_CATALOG) as ErrorCode[]).map((code) => ({
  code,
  ...ERROR_CATALOG[code],
}));

const NAV_MANUAL = [
  { id: "quickstart", label: "Quickstart" },
  { id: "sdk", label: "SDK" },
  { id: "tokens", label: "Registration tokens" },
  { id: "widget", label: "Key widget" },
  { id: "calling", label: "Calling AI" },
  { id: "embeddings", label: "Embeddings" },
  { id: "errors", label: "Errors & tracing" },
  { id: "reference", label: "API reference" },
];

const NAV_AI = [
  { id: "ai-overview", label: "Overview" },
  { id: "ai-prompt", label: "Integration prompt" },
];

const AI_PROMPT = [
  "You are integrating Relay BYOK (Bring Your Own Key) into this codebase.",
  "Relay lets end-users connect their own OpenAI / Anthropic / Google API keys.",
  "Your server proxies AI calls through Relay — you never handle the user's raw key.",
  "",
  "Your Relay key: add it to .env as RELAY_KEY (get it from https://relayservice.im → Console).",
  "Full reference docs: https://relayservice.im/docs",
  "",
  "---",
  "",
  "Complete all 4 steps below in order. Do not stop to ask unless something is genuinely",
  "ambiguous about THIS codebase (e.g. you cannot find where backend routes live, or you",
  "cannot identify the user ID field). For everything else, make a reasonable choice and proceed.",
  "",
  "---",
  "",
  "STEP 1 — Install the SDK",
  "Run:",
  "  npm install @relayservice/sdk openai",
  "",
  "Set up the Relay client in a shared server-side module (e.g. lib/relay.ts).",
  "Never import this file from the client side.",
  "  import { Relay } from \"@relayservice/sdk\";",
  "  export const relay = new Relay({ key: process.env.RELAY_KEY });",
  "",
  "STEP 2 — Create a backend endpoint: POST /api/relay/token",
  "This endpoint must:",
  "- Require an authenticated session (use whatever auth this project already uses)",
  "- Call relay.createRegistrationToken() for the current user:",
  "    const { registrationToken } = await relay.createRegistrationToken({",
  "      user: <current user's ID as a string>,",
  "    });",
  "- Return { registrationToken } as JSON",
  "",
  "STEP 3 — Embed the Relay widget on the frontend",
  "Find the most appropriate settings or onboarding page and add:",
  "  <div id=\"relay-widget\"></div>",
  "  <script src=\"https://vault.relayservice.im/widget.js\"></script>",
  "  <script>",
  "    fetch('/api/relay/token')",
  "      .then(r => r.json())",
  "      .then(({ registrationToken }) => {",
  "        Relay.mount('#relay-widget', {",
  "          registrationToken,",
  "          theme: 'light',",
  "          onSuccess: (r) => console.log('Key connected:', r.provider),",
  "        });",
  "      });",
  "  </script>",
  "The widget renders in a Shadow DOM — no CSS conflicts.",
  "The user's key goes directly to Relay over TLS; your server never sees it.",
  "",
  "STEP 4 — Make AI calls on behalf of a user",
  "Replace any existing direct OpenAI calls with the Relay-proxied client.",
  "  const ai = relay.openai({ user: <current user's ID as a string> });",
  "  const completion = await ai.chat.completions.create({",
  "    model: \"gpt-4o-mini\",",
  "    messages: [{ role: \"user\", content: \"...\" }],",
  "  });",
  "The model name selects the provider: gpt-* → OpenAI, claude-* → Anthropic, gemini-* → Google.",
  "Streaming works the same way — just add stream: true.",
  "",
  "---",
  "",
  "DEFINITION OF DONE — verify each before telling me you're finished:",
  "[ ] RELAY_KEY is only referenced in server-side code; grep confirms it is not in any client bundle",
  "[ ] POST /api/relay/token exists, requires auth, and returns a registrationToken",
  "[ ] The widget is mounted on at least one frontend page and fetches its token from /api/relay/token",
  "[ ] At least one AI call uses relay.openai({ user }) with the real user ID",
  "[ ] The app builds without errors (run the build command and confirm it passes)",
  "",
  "Start with Step 1 now.",
].join("\n");

type Mode = "manual" | "ai";

export default function PublicDocs() {
  const [mode, setMode] = useState<Mode>("manual");

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
            {(mode === "manual" ? NAV_MANUAL : NAV_AI).map((n) => (
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

          <div className={s.tabRow}>
            <button
              className={`${s.tab} ${mode === "manual" ? s.tabActive : ""}`}
              onClick={() => setMode("manual")}
            >
              Build it yourself
            </button>
            <button
              className={`${s.tab} ${mode === "ai" ? s.tabActive : ""}`}
              onClick={() => setMode("ai")}
            >
              Integrate with AI
            </button>
          </div>

          {mode === "manual" && (
            <>
              <section id="quickstart" className={s.section}>
                <h2 className={s.h2}>Quickstart</h2>
                <p className={s.p}>Install the SDK and the OpenAI client (required as a peer dependency):</p>
                <CodeBlock>{`npm install @relayservice/sdk openai`}</CodeBlock>
                <p className={s.p}>Set up the Relay client in a shared server-side module. Never import this on the client.</p>
                <CodeBlock>{`import { Relay } from "@relayservice/sdk";

export const relay = new Relay({ key: process.env.RELAY_KEY });`}</CodeBlock>
                <p className={s.note}>
                  Get your <code>rly-</code> key from the{" "}
                  <Link href="/login">Relay console</Link>.
                </p>
              </section>

              <section id="sdk" className={s.section}>
                <h2 className={s.h2}>SDK</h2>
                <p className={s.p}>
                  The SDK has two methods: <code>createRegistrationToken</code> for onboarding users,
                  and <code>openai</code> which returns a pre-configured OpenAI client bound to a specific user.
                </p>
                <CodeBlock>{`const relay = new Relay({ key: "rly-..." });

// Issue a token so a user can connect their key
const { registrationToken } = await relay.createRegistrationToken({ user: "jieun_123" });

// Get an OpenAI client bound to that user
const ai = relay.openai({ user: "jieun_123" });
const res = await ai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }],
});`}</CodeBlock>
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
                  Every error response includes a stable <code>code</code>, a <code>doc_url</code>, and a
                  <code> request_id</code> (also sent as the <code>X-Relay-Request-Id</code> header). Branch on
                  <code> code</code> — not the human <code>message</code>, which may change.
                </p>
                <CodeBlock>{`{
  "error": {
    "message": "Unknown or revoked Relay key",
    "type": "invalid_request_error",
    "code": "relay_key_revoked",
    "doc_url": "https://relayservice.im/docs#relay_key_revoked",
    "request_id": "req_..."
  }
}`}</CodeBlock>
                <p className={s.p}>
                  The SDK surfaces these on <code>RelayError</code> (<code>.code</code>, <code>.status</code>,
                  <code> .requestId</code>, <code>.docUrl</code>). AI calls throw the OpenAI client&apos;s errors,
                  which carry the same <code>code</code> in the error body.
                </p>
                <CodeBlock>{`try {
  await relay.registrationToken({ user: "alice" });
} catch (err) {
  if (err instanceof RelayError && err.code === "relay_key_revoked") {
    // rotate the key
  }
}`}</CodeBlock>

                <h3 className={s.h2}>Error codes</h3>
                <table className={s.table}>
                  <thead>
                    <tr><th>Code</th><th>HTTP</th><th>Meaning</th><th>How to fix</th></tr>
                  </thead>
                  <tbody>
                    {ERROR_ROWS.map((r) => (
                      <tr key={r.code} id={r.code}>
                        <td className={s.mono}>{r.code}</td>
                        <td>{r.status}</td>
                        <td>{r.meaning}</td>
                        <td>{r.fix}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            </>
          )}

          {mode === "ai" && (
            <>
              <section id="ai-overview" className={s.section}>
                <h2 className={s.h2}>Let AI do the integration</h2>
                <p className={s.p}>
                  Copy the prompt below and paste it into your AI coding agent, CLI, or chat interface.
                  The AI will complete all 4 steps and verify each one before finishing.
                </p>
                <ol className={s.stepList}>
                  <li>Get your <code>rly-</code> key from the <Link href="/login">Relay console</Link> and add it to <code>.env</code> as <code>RELAY_KEY</code></li>
                  <li>Copy the prompt below</li>
                  <li>Paste it into your AI coding agent, CLI, or chat interface</li>
                  <li>Answer any codebase-specific questions the AI asks</li>
                </ol>
              </section>

              <section id="ai-prompt" className={s.section}>
                <h2 className={s.h2}>Integration prompt</h2>
                <CopyablePrompt prompt={AI_PROMPT} />
              </section>
            </>
          )}

          <footer className={s.footer}>
            <span>Secured by Relay</span>
            <Link href="/login">Open console →</Link>
          </footer>
        </main>
      </div>
    </div>
  );
}

function CopyablePrompt({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={s.promptBox}>
      <div className={s.promptHeader}>
        <span className={s.promptLabel}>Prompt — paste into your AI coding agent, CLI, or chat interface</span>
        <button className={s.copyBtn} onClick={handleCopy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className={s.promptPre}>{prompt}</pre>
    </div>
  );
}
