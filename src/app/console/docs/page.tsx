import { redirect } from "next/navigation";
import { getCurrentDeveloper } from "@/lib/auth";
import { Shell, shellStyles } from "@/components/Shell";
import { Card, CodeBlock, uiStyles } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const me = await getCurrentDeveloper();
  if (!me) redirect("/login");
  const rly = me.tenant.rlyKey;

  return (
    <Shell
      title="Docs"
      account={{ name: me.account.name, email: me.account.email, picture: me.account.picture }}
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
  baseURL: "https://api.relaypay.im/v1",
  apiKey: "${rly}",            // your Relay key
});`}</CodeBlock>
        </Card>

        <Card title="2. Issue a registration token (your backend)">
          <p className={uiStyles.cardDesc} style={{ marginTop: 0, marginBottom: 12 }}>
            When a user wants to connect their key, ask Relay for a short-lived,
            single-use token scoped to that user.
          </p>
          <CodeBlock>{`const res = await fetch("https://api.relaypay.im/api/v1/registration-tokens", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${rly}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ endUserLabel: "jieun_123", provider: "openai" }),
});
const { registrationToken } = await res.json();`}</CodeBlock>
        </Card>

        <Card title="3. Embed the widget (your frontend)">
          <p className={uiStyles.cardDesc} style={{ marginTop: 0, marginBottom: 12 }}>
            The user pastes their key here. It goes straight to Relay over TLS —
            your server never sees it.
          </p>
          <CodeBlock>{`<div id="relay-pay"></div>
<script src="https://relaypay.im/widget.js"></script>
<script>
  RelayPay.mount('#relay-pay', {
    registrationToken: registrationToken, // from step 2
    provider: 'openai',
  });
</script>`}</CodeBlock>
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
