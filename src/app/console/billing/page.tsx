import { redirect } from "next/navigation";
import { getCurrentDeveloper } from "@/lib/auth";
import { getActiveKeyStats } from "@/lib/usageStats";
import { PLANS } from "@/lib/billing/plans";
import { estimateBill } from "@/lib/billing/estimate";
import { Shell, shellStyles } from "@/components/Shell";
import { shellPropsFromMe } from "@/lib/shellProps";
import { Card, StatCard, StatCardGrid, uiStyles } from "@/components/ui";

export const dynamic = "force-dynamic";

const usd = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function BillingPage() {
  const me = await getCurrentDeveloper();
  if (!me) redirect("/login");
  const tenantId = String(me.tenant._id);
  const keys = await getActiveKeyStats(tenantId, "live");
  const plan = PLANS[me.tenant.plan];
  const bill = estimateBill(me.tenant.plan, keys.paidActiveKeys);

  return (
    <Shell
      title="Billing"
      {...shellPropsFromMe(me)}
    >
      <div className={shellStyles.pageHead}>
        <h1 className={shellStyles.pageTitle}>Billing</h1>
        <p className={shellStyles.pageSub}>
          Your usage and estimated charge. The Bootstrap plan is free — see the note below.
        </p>
      </div>

      <div className={shellStyles.stack}>
        {/* 정직 안내 — Bootstrap 무료 플랜, 결제 자동화 아직 없음 */}
        <Card
          title="Bootstrap plan — free"
          desc="You're on the Bootstrap plan: free until you outgrow it. Automated billing for paid plans is on the roadmap, so nothing is charged today regardless of usage. If you'd like a paid plan or a custom arrangement, just reach out."
        >
        </Card>

        <StatCardGrid>
          <StatCard
            label="Active keys"
            value={keys.paidActiveKeys.toLocaleString()}
            sub={
              keys.allActiveKeys !== keys.paidActiveKeys
                ? `${keys.allActiveKeys.toLocaleString()} total · paid only billed`
                : "this month"
            }
          />
          <StatCard
            label="Plan"
            value={plan.label}
            sub={
              bill.custom
                ? "custom contract"
                : plan.id === "free"
                  ? `Free until you outgrow it · ${plan.includedKeys.toLocaleString()} keys included`
                  : `${plan.includedKeys.toLocaleString()} keys included`
            }
          />
          <StatCard
            label="Estimated charge"
            value={bill.custom ? "Custom" : usd(bill.totalUsd)}
            sub="not billed yet"
          />
        </StatCardGrid>

        <Card
          title="What you'd be billed (when billing goes live)"
          desc="Reference only — nothing is charged today. The amount reflects active keys this month against your plan."
        >
          {bill.custom ? (
            <p style={{ fontSize: 14, color: "var(--ink-2)", margin: 0 }}>
              Enterprise — billing is handled by contract. {keys.paidActiveKeys.toLocaleString()} active keys this month.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                rowGap: 8,
                fontSize: 14,
                maxWidth: 460,
              }}
            >
              <span style={{ color: "var(--ink-3)" }}>Base ({plan.label})</span>
              <span className={uiStyles.cellMono}>{usd(bill.baseUsd)}</span>
              <span style={{ color: "var(--ink-3)" }}>
                Overage · {bill.overageKeys.toLocaleString()} keys × {usd(plan.overagePerKeyUsd)}
              </span>
              <span className={uiStyles.cellMono}>{usd(bill.overageUsd)}</span>
              <span style={{ borderTop: "1px solid var(--line)", paddingTop: 8, fontWeight: 600 }}>
                Would-be total
              </span>
              <span
                className={uiStyles.cellMono}
                style={{ borderTop: "1px solid var(--line)", paddingTop: 8, fontWeight: 600 }}
              >
                {usd(bill.totalUsd)}
              </span>
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
