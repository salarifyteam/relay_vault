import { redirect } from "next/navigation";
import { getCurrentDeveloper } from "@/lib/auth";
import { Shell, shellStyles } from "@/components/Shell";
import { OriginsEditor } from "@/components/OriginsEditor";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await getCurrentDeveloper();
  if (!me) redirect("/login");

  return (
    <Shell
      title="Settings"
      account={{ name: me.account.name, email: me.account.email, picture: me.account.picture }}
    >
      <div className={shellStyles.pageHead}>
        <h1 className={shellStyles.pageTitle}>Settings</h1>
        <p className={shellStyles.pageSub}>Manage your app&apos;s configuration.</p>
      </div>

      <div className={shellStyles.stack}>
        <Card title="App">
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 10, fontSize: 14 }}>
            <span style={{ color: "var(--ink-3)" }}>Name</span>
            <span>{me.tenant.name}</span>
            <span style={{ color: "var(--ink-3)" }}>Owner</span>
            <span>{me.account.email}</span>
          </div>
        </Card>

        <OriginsEditor initial={me.tenant.allowedOrigins} />
      </div>
    </Shell>
  );
}
