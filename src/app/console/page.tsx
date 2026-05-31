import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentDeveloper } from "@/lib/auth";
import { getTenantUsage, getActiveKeyStats, relativeTime } from "@/lib/usageStats";
import { Shell, shellStyles } from "@/components/Shell";
import { shellPropsFromMe } from "@/lib/shellProps";
import {
  Card,
  StatCard,
  StatCardGrid,
  CodeBlock,
  EmptyState,
  Button,
  uiStyles,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ConsoleHome() {
  const me = await getCurrentDeveloper();
  if (!me) redirect("/login");

  const tenantId = String(me.tenant._id);
  // 홈 대시보드는 live 비즈니스 지표를 보여준다(과금 기준).
  const [usage, keys] = await Promise.all([
    getTenantUsage(tenantId, 8, "live"),
    getActiveKeyStats(tenantId, "live"),
  ]);

  return (
    <Shell
      title="Home"
      {...shellPropsFromMe(me)}
    >
      <div className={shellStyles.pageHead}>
        <h1 className={shellStyles.pageTitle}>Home</h1>
        <p className={shellStyles.pageSub}>
          Your end-users bring their own AI keys. You never see them.
        </p>
      </div>

      <div className={shellStyles.stack}>
        <Card
          title="API keys"
          desc="Create and manage your test and live keys. The full key is shown once at creation."
          action={
            <Link href="/console/keys">
              <Button variant="secondary" size="sm">Manage keys</Button>
            </Link>
          }
        >
          <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 13 }}>
            Use a <b>test</b> key while building and a <b>live</b> key in production — they&apos;re
            fully isolated.
          </p>
        </Card>

        <div>
          <div className={uiStyles.eyebrow} style={{ marginBottom: 10 }}>
            Usage this month
          </div>
          <StatCardGrid>
            <StatCard label="Active keys" value={keys.paidActiveKeys.toLocaleString()} sub="billed this month" />
            <StatCard label="Requests" value={usage.requests.toLocaleString()} />
            <StatCard
              label="Est. cost"
              value={`$${usage.costUsd.toFixed(usage.costUsd < 1 ? 4 : 2)}`}
              sub="across all providers"
            />
            <StatCard label="End-users" value={String(usage.endUsers)} sub="with a connected key" />
          </StatCardGrid>
        </div>

        <Card title="Recent requests">
          {usage.recent.length === 0 ? (
            <EmptyState title="No requests yet">
              Once your app proxies a call through Relay, it shows up here.
            </EmptyState>
          ) : (
            <table className={uiStyles.table}>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>End-user</th>
                  <th>Tokens</th>
                  <th style={{ textAlign: "right" }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {usage.recent.map((r, i) => (
                  <tr key={i}>
                    <td className={uiStyles.cellMono}>{r.model}</td>
                    <td className={uiStyles.cellMono}>{r.endUserLabel}</td>
                    <td className={uiStyles.cellMono}>
                      {r.inputTokens + r.outputTokens}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--ink-3)" }}>
                      {relativeTime(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card
          title="Embed the key widget"
          desc="Drop this into your app so users connect their own key — it goes straight to Relay."
        >
          <CodeBlock>{`<div id="relay-widget"></div>
<script src="https://vault.relayservice.im/widget.js"></script>
<script>
  Relay.mount('#relay-widget', {
    registrationToken: 'rgt_…',   // from your backend
    provider: 'openai',
  });
</script>`}</CodeBlock>
        </Card>
      </div>
    </Shell>
  );
}
