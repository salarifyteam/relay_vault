import { redirect } from "next/navigation";
import { getCurrentDeveloper } from "@/lib/auth";
import { Shell, shellStyles } from "@/components/Shell";
import { shellPropsFromMe } from "@/lib/shellProps";
import { MembersManager } from "@/components/MembersManager";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const me = await getCurrentDeveloper();
  if (!me) redirect("/login");
  const canManage = me.role === "owner";

  return (
    <Shell
      title="Members"
      {...shellPropsFromMe(me)}
    >
      <div className={shellStyles.pageHead}>
        <h1 className={shellStyles.pageTitle}>Members</h1>
        <p className={shellStyles.pageSub}>
          People with access to <strong>{me.tenant.name}</strong>. Only owners can invite or remove
          members; members can manage everything else.
        </p>
      </div>

      <div className={shellStyles.stack}>
        <MembersManager canManage={canManage} currentAccountId={String(me.account._id)} />
      </div>
    </Shell>
  );
}
