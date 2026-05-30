import { redirect } from "next/navigation";
import { getCurrentDeveloper } from "@/lib/auth";
import { getTenantUsage, getActiveKeyStats, relativeTime } from "@/lib/usageStats";
import { maskByokKey } from "@/lib/services/byokProvider";
import { Shell, shellStyles } from "@/components/Shell";
import { shellPropsFromMe } from "@/lib/shellProps";
import { ApiKeyCard } from "@/components/ApiKeyCard";
import {
  Card,
  StatCard,
  StatCardGrid,
  CodeBlock,
  EmptyState,
  uiStyles,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ConsoleHome() {
  const me = await getCurrentDeveloper();
  if (!me) redirect("/login");

  const rlyKey = me.tenant.rlyKey;
  const tenantId = String(me.tenant._id);
  const [usage, keys] = await Promise.all([
    getTenantUsage(tenantId),
    getActiveKeyStats(tenantId),
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
        <ApiKeyCard initialKey={rlyKey} initialMasked={maskByokKey(rlyKey)} />

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
