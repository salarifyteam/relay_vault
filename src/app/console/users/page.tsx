import { redirect } from "next/navigation";
import { getCurrentDeveloper } from "@/lib/auth";
import { getTenantEndUsers } from "@/lib/usageStats";
import { Shell, shellStyles } from "@/components/Shell";
import { Card, StatusPill, EmptyState, uiStyles } from "@/components/ui";
import { EndUserActions } from "@/components/EndUserActions";

export const dynamic = "force-dynamic";

export default async function EndUsersPage() {
  const me = await getCurrentDeveloper();
  if (!me) redirect("/login");
  const users = await getTenantEndUsers(String(me.tenant._id));

  return (
    <Shell
      title="End-users"
      account={{ name: me.account.name, email: me.account.email, picture: me.account.picture }}
    >
      <div className={shellStyles.pageHead}>
        <h1 className={shellStyles.pageTitle}>End-users</h1>
        <p className={shellStyles.pageSub}>
          People using your app who connected their own AI key. You can&apos;t see the keys —
          only that they exist.
        </p>
      </div>

      <Card>
        {users.length === 0 ? (
          <EmptyState title="No connected keys yet">
            When a user connects a key through the widget, they appear here.
          </EmptyState>
        ) : (
          <table className={uiStyles.table}>
            <thead>
              <tr>
                <th>End-user</th>
                <th>Provider</th>
                <th>Key</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Spent</th>
                <th style={{ textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i} style={u.isActive ? undefined : { opacity: 0.55 }}>
                  <td className={uiStyles.cellMono}>{u.endUserLabel}</td>
                  <td>{u.provider}</td>
                  <td className={uiStyles.cellMono}>{u.keyMasked}</td>
                  <td>
                    {!u.isActive ? (
                      <StatusPill kind="danger">revoked</StatusPill>
                    ) : u.validationState === "valid" ? (
                      <StatusPill kind="success">valid</StatusPill>
                    ) : u.validationState === "invalid" ? (
                      <StatusPill kind="danger">invalid</StatusPill>
                    ) : (
                      <StatusPill kind="warn">pending</StatusPill>
                    )}
                  </td>
                  <td className={uiStyles.cellMono} style={{ textAlign: "right" }}>
                    ${u.spentUsd.toFixed(u.spentUsd < 1 ? 4 : 2)}
                    {u.spendCapUsd != null ? ` / $${u.spendCapUsd}` : ""}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <EndUserActions endUserLabel={u.endUserLabel} provider={u.provider} isActive={u.isActive} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </Shell>
  );
}
