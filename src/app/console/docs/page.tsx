import { redirect } from "next/navigation";
import { getCurrentDeveloper } from "@/lib/auth";
import { Shell, shellStyles } from "@/components/Shell";
import { shellPropsFromMe } from "@/lib/shellProps";
import { Card, CodeBlock, uiStyles } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const me = await getCurrentDeveloper();
  if (!me) redirect("/login");
  const rly = me.tenant.rlyKey;

  return (
    <Shell
      title="Docs"
      {...shellPropsFromMe(me)}
    >
      <div className={shellStyles.pageHead}>
        <h1 className={shellStyles.pageTitle}>Quickstart</h1>
        <p className={shellStyles.pageSub}>
          Add BYOK to your app in four steps. Your key is filled in below.
        </p>
      </div>

      <div className={shellStyles.stack}>
        <Card title="1. Point your AI calls at Relay">
          <p className={uiStyles.cardDesc} style={{ marginTop: 0, marginBottom: 12 }}>
            Keep your OpenAI-format code. Just change the base URL and use your Relay key.
            The model name decides the provider — <code>gpt-*</code>, <code>claude-*</code>,{" "}
            <code>gemini-*</code>.
          </p>
          <CodeBlock>{`import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://vault.relayservice.im/v1",
  apiKey: "${rly}",            // your Relay key
});`}</CodeBlock>
        </Card>

        <Card title="2. Issue a registration token (your backend)">
          <p className={uiStyles.cardDesc} style={{ marginTop: 0, marginBottom: 12 }}>
            When a user wants to connect their key, ask Relay for a short-lived,
            single-use token scoped to that user. Omit <code>provider</code> to let
            the user pick (OpenAI / Anthropic / Google) in the widget, or set it to
            lock the widget to one provider.
          </p>
          <CodeBlock>{`const res = await fetch("https://vault.relayservice.im/api/v1/registration-tokens", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${rly}",
    "Content-Type": "application/json",
  },
  // omit "provider" → user chooses in the widget; or set "provider": "openai" to lock it
  body: JSON.stringify({ endUserLabel: "jieun_123" }),
});
const { registrationToken } = await res.json();`}</CodeBlock>
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
    // provider: 'openai',   // optional — omit to show the provider picker
    // theming & i18n (all optional):
    theme: 'light',          // 'light' | 'dark'
    accentColor: '#635bff',  // your brand color
    radius: 12,              // corner radius (px)
    locale: 'en',            // 'en' | 'ko'
    onSuccess: (r) => console.log('connected', r.provider, r.masked),
    onError:   (e) => console.warn(e),
  });
</script>`}</CodeBlock>
          <p className={uiStyles.cardDesc} style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>
            The widget renders in a Shadow DOM, so your site&apos;s CSS can&apos;t
            break it and vice versa. It&apos;s responsive (desktop &amp; mobile web).
            On native apps, show it in a WebView pointing at a page that mounts the
            widget.
          </p>
        </Card>

        <Card title="4. Make calls on behalf of a user">
          <p className={uiStyles.cardDesc} style={{ marginTop: 0, marginBottom: 12 }}>
            Add the <code>X-Relay-User</code> header so Relay injects that
            user&apos;s stored key. Everything else is plain OpenAI format.
          </p>
          <CodeBlock>{`const completion = await client.chat.completions.create(
  {
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Hello!" }],
  },
  { headers: { "X-Relay-User": "jieun_123" } }
);`}</CodeBlock>
        </Card>
      </div>
    </Shell>
  );
}
