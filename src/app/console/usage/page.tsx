import { redirect } from "next/navigation";
import { getCurrentDeveloper } from "@/lib/auth";
import { getTenantUsage, getActiveKeyStats, relativeTime } from "@/lib/usageStats";
import { PLANS } from "@/lib/billing/plans";
import { estimateBill, suggestUpgrade } from "@/lib/billing/estimate";
import { Shell, shellStyles } from "@/components/Shell";
import { shellPropsFromMe } from "@/lib/shellProps";
import { Card, StatCard, StatCardGrid, EmptyState, uiStyles } from "@/components/ui";

export const dynamic = "force-dynamic";

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function UsagePage() {
  const me = await getCurrentDeveloper();
  if (!me) redirect("/login");
  const tenantId = String(me.tenant._id);
  const [usage, keys] = await Promise.all([
    getTenantUsage(tenantId, 40),
    getActiveKeyStats(tenantId),
  ]);
  const plan = PLANS[me.tenant.plan];
  const bill = estimateBill(me.tenant.plan, keys.paidActiveKeys);
  const upgrade = suggestUpgrade(me.tenant.plan, keys.paidActiveKeys);

  return (
    <Shell
      title="Usage"
      {...shellPropsFromMe(me)}
    >
      <div className={shellStyles.pageHead}>
        <h1 className={shellStyles.pageTitle}>Usage</h1>
        <p className={shellStyles.pageSub}>Requests across all your end-users, this month.</p>
      </div>

      <div className={shellStyles.stack}>
        <StatCardGrid>
          <StatCard
            label="Active keys"
            value={keys.paidActiveKeys.toLocaleString()}
            sub={keys.allActiveKeys !== keys.paidActiveKeys ? `${keys.allActiveKeys.toLocaleString()} total · billed on paid` : "billed this month"}
          />
          <StatCard label="Plan" value={plan.label} sub={bill.custom ? "custom contract" : `${plan.includedKeys.toLocaleString()} keys included`} />
          <StatCard
            label="Est. bill this month"
            value={bill.custom ? "Custom" : usd(bill.totalUsd)}
            sub={bill.custom ? "contact us" : bill.overageKeys > 0 ? `incl. ${bill.overageKeys.toLocaleString()} over` : "within included"}
          />
          <StatCard label="Requests" value={usage.requests.toLocaleString()} sub="proxied this month" />
        </StatCardGrid>

        <Card title="Billing" desc="Relay bills your team by active keys — distinct end-user keys with at least one request this month. AI usage itself is billed by the provider on each end-user's own key.">
          {bill.custom ? (
            <p style={{ fontSize: 14, color: "var(--ink-2)", margin: 0 }}>
              Enterprise plan — billing is handled by contract. {keys.paidActiveKeys.toLocaleString()} active keys this month.
            </p>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 8, fontSize: 14, maxWidth: 460 }}>
                <span style={{ color: "var(--ink-3)" }}>Base ({plan.label})</span>
                <span className={uiStyles.cellMono}>{usd(bill.baseUsd)}</span>
                <span style={{ color: "var(--ink-3)" }}>
                  Overage · {bill.overageKeys.toLocaleString()} keys × {usd(plan.overagePerKeyUsd)}
                </span>
                <span className={uiStyles.cellMono}>{usd(bill.overageUsd)}</span>
                <span style={{ borderTop: "1px solid var(--line)", paddingTop: 8, fontWeight: 600 }}>Estimated total</span>
                <span className={uiStyles.cellMono} style={{ borderTop: "1px solid var(--line)", paddingTop: 8, fontWeight: 600 }}>{usd(bill.totalUsd)}</span>
              </div>
              {plan.hardCapKeys != null && (
                <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 14, marginBottom: 0 }}>
                  Free plan includes up to {plan.hardCapKeys.toLocaleString()} active keys. New keys are blocked once you reach the cap — upgrade to add more.
                </p>
              )}
              {upgrade && (
                <p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 14, marginBottom: 0 }}>
                  At {keys.paidActiveKeys.toLocaleString()} active keys, the <strong>{PLANS[upgrade].label}</strong> plan ({usd(estimateBill(upgrade, keys.paidActiveKeys).totalUsd)}/mo) is cheaper than your current plan.
                </p>
              )}
            </>
          )}
        </Card>

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
