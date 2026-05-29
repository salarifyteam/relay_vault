import { redirect } from "next/navigation";
import { getCurrentDeveloper } from "@/lib/auth";
import { maskByokKey } from "@/lib/services/byokProvider";
import { Shell, shellStyles } from "@/components/Shell";
import { ApiKeyCard } from "@/components/ApiKeyCard";
import { Card, uiStyles } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const me = await getCurrentDeveloper();
  if (!me) redirect("/login");
  const rly = me.tenant.rlyKey;

  return (
    <Shell
      title="API keys"
      account={{ name: me.account.name, email: me.account.email, picture: me.account.picture }}
    >
      <div className={shellStyles.pageHead}>
        <h1 className={shellStyles.pageTitle}>API keys</h1>
        <p className={shellStyles.pageSub}>
          One secret key identifies your app to Relay. Your users&apos; keys are stored
          separately and never shown here.
        </p>
      </div>

      <div className={shellStyles.stack}>
        <ApiKeyCard initialKey={rly} initialMasked={maskByokKey(rly)} />

        <Card title="Keep it secret">
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)", fontSize: 13, lineHeight: 1.9 }}>
            <li>Use this key only on your <b>backend</b> — never ship it to the browser.</li>
            <li>It authenticates your app, not your users. Don&apos;t hand it to end-users.</li>
            <li>
              If it leaks, hit <span className={uiStyles.cellMono}>Regenerate</span> — the old key
              stops working immediately.
            </li>
          </ul>
        </Card>
      </div>
    </Shell>
  );
}
