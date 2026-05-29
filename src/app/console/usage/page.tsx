import { redirect } from "next/navigation";
import { getCurrentDeveloper } from "@/lib/auth";
import { getTenantUsage, relativeTime } from "@/lib/usageStats";
import { Shell, shellStyles } from "@/components/Shell";
import { Card, StatCard, StatCardGrid, EmptyState, uiStyles } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const me = await getCurrentDeveloper();
  if (!me) redirect("/login");
  const usage = await getTenantUsage(String(me.tenant._id), 40);

  return (
    <Shell
      title="Usage"
      account={{ name: me.account.name, email: me.account.email, picture: me.account.picture }}
    >
      <div className={shellStyles.pageHead}>
        <h1 className={shellStyles.pageTitle}>Usage</h1>
        <p className={shellStyles.pageSub}>Requests across all your end-users, this month.</p>
      </div>

      <div className={shellStyles.stack}>
        <StatCardGrid>
          <StatCard label="Requests" value={usage.requests.toLocaleString()} />
          <StatCard
            label="Est. cost"
            value={`$${usage.costUsd.toFixed(usage.costUsd < 1 ? 4 : 2)}`}
            sub="across all providers"
          />
          <StatCard label="End-users" value={String(usage.endUsers)} sub="with a connected key" />
        </StatCardGrid>

        <Card title="Requests">
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
                  <th>Input</th>
                  <th>Output</th>
                  <th>Mode</th>
                  <th style={{ textAlign: "right" }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {usage.recent.map((r, i) => (
                  <tr key={i}>
                    <td className={uiStyles.cellMono}>{r.model}</td>
                    <td className={uiStyles.cellMono}>{r.endUserLabel}</td>
                    <td className={uiStyles.cellMono}>{r.inputTokens}</td>
                    <td className={uiStyles.cellMono}>{r.outputTokens}</td>
                    <td style={{ color: "var(--ink-3)" }}>{r.stream ? "stream" : "sync"}</td>
                    <td style={{ textAlign: "right", color: "var(--ink-3)" }}>
                      {relativeTime(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </Shell>
  );
}
