"use client";

import { useState } from "react";
import { Card, CodeBlock, uiStyles } from "@/components/ui";
import { shellStyles } from "@/components/Shell";
import s from "./docs.module.css";

function buildPrompt(rly: string): string {
  return [
    "You are integrating Relay BYOK (Bring Your Own Key) into this codebase.",
    "Relay lets end-users connect their own OpenAI / Anthropic / Google API keys.",
    "Your server proxies AI calls through Relay — you never handle the user's raw key.",
    "",
    "The Relay key for this project is: " + rly,
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
    "The model name selects the provider automatically: gpt-* → OpenAI, claude-* → Anthropic, gemini-* → Google.",
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
}

type Mode = "manual" | "ai";

export function DocsContent({ rly }: { rly: string }) {
  const [mode, setMode] = useState<Mode>("manual");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(buildPrompt(rly));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className={shellStyles.pageHead}>
        <h1 className={shellStyles.pageTitle}>Quickstart</h1>
        <p className={shellStyles.pageSub}>
          Add BYOK to your app in four steps. Your key is filled in below.
        </p>
      </div>

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
        <div className={shellStyles.stack}>
          <Card title="1. Install the SDK">
            <p className={uiStyles.cardDesc} style={{ marginTop: 0, marginBottom: 12 }}>
              Install the Relay SDK and the OpenAI client (required as a peer dependency).
            </p>
            <CodeBlock>{`npm install @relayservice/sdk openai`}</CodeBlock>
            <p className={uiStyles.cardDesc} style={{ marginTop: 12, marginBottom: 12 }}>
              Set up the Relay client in a shared server-side module. Never import this on the client.
            </p>
            <CodeBlock>{`import { Relay } from "@relayservice/sdk";

export const relay = new Relay({ key: process.env.RELAY_KEY });`}</CodeBlock>
          </Card>

          <Card title="2. Issue a registration token (your backend)">
            <p className={uiStyles.cardDesc} style={{ marginTop: 0, marginBottom: 12 }}>
              When a user wants to connect their key, issue a short-lived, single-use token
              scoped to that user. Omit <code>provider</code> to let the user pick
              (OpenAI / Anthropic / Google) in the widget, or set it to lock to one provider.
            </p>
            <CodeBlock>{`const { registrationToken } = await relay.createRegistrationToken({
  user: "jieun_123",
  // provider: "openai",  // optional
});`}</CodeBlock>
          </Card>

          <Card title="3. Embed the widget (your frontend)">
            <p className={uiStyles.cardDesc} style={{ marginTop: 0, marginBottom: 12 }}>
              The user pastes their key here. It goes straight to Relay over TLS —
              your server never sees it.
            </p>
            <CodeBlock>{`<div id="relay-widget"></div>
<script src="https://vault.relayservice.im/widget.js"></script>
<script>
  Relay.mount('#relay-widget', {
    registrationToken: registrationToken, // from step 2
    theme: 'light',          // 'light' | 'dark'
    accentColor: '#635bff',
    locale: 'en',            // 'en' | 'ko'
    onSuccess: (r) => console.log('connected', r.provider, r.masked),
    onError:   (e) => console.warn(e),
  });
</script>`}</CodeBlock>
            <p className={uiStyles.cardDesc} style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>
              The widget renders in a Shadow DOM, so your site&apos;s CSS can&apos;t
              break it and vice versa. On native apps, show it in a WebView.
            </p>
          </Card>

          <Card title="4. Make calls on behalf of a user">
            <p className={uiStyles.cardDesc} style={{ marginTop: 0, marginBottom: 12 }}>
              Get a pre-configured OpenAI client bound to a specific user.
              The model name picks the provider — <code>gpt-*</code>, <code>claude-*</code>,{" "}
              <code>gemini-*</code>. Streaming works the same way.
            </p>
            <CodeBlock>{`const ai = relay.openai({ user: "jieun_123" });

const completion = await ai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }],
});`}</CodeBlock>
          </Card>
        </div>
      )}

      {mode === "ai" && (
        <div className={shellStyles.stack}>
          <Card title="Let AI do the integration">
            <p className={uiStyles.cardDesc} style={{ marginTop: 0, marginBottom: 12 }}>
              Copy the prompt below and paste it into your AI coding agent, CLI, or chat interface.
              Your <code>rly-</code> key is already embedded — the AI will complete
              all 4 steps and verify each one before finishing.
            </p>
            <ol className={s.stepList}>
              <li>Copy the prompt below</li>
              <li>Paste it into your AI coding agent, CLI, or chat interface</li>
              <li>Answer any codebase-specific questions the AI asks</li>
            </ol>
          </Card>

          <Card title="Integration prompt">
            <div className={s.promptBox}>
              <div className={s.promptHeader}>
                <span className={s.promptLabel}>Prompt — paste into your AI coding agent, CLI, or chat interface</span>
                <button className={s.copyBtn} onClick={handleCopy}>
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <pre className={s.promptPre}>{buildPrompt(rly)}</pre>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
