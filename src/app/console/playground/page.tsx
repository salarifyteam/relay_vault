import { redirect } from "next/navigation";
import { getCurrentDeveloper } from "@/lib/auth";
import { Shell, shellStyles } from "@/components/Shell";
import { shellPropsFromMe } from "@/lib/shellProps";
import { PlaygroundClient } from "@/components/PlaygroundClient";

export const dynamic = "force-dynamic";

export default async function PlaygroundPage() {
  const me = await getCurrentDeveloper();
  if (!me) redirect("/login");

  return (
    <Shell title="Playground" {...shellPropsFromMe(me)}>
      <div className={shellStyles.pageHead}>
        <h1 className={shellStyles.pageTitle}>Playground</h1>
        <p className={shellStyles.pageSub}>
          Make real Relay API calls from the dashboard. Requests run in <b>test</b> mode — your
          key never leaves the server.
        </p>
      </div>

      <div className={shellStyles.stack}>
        <PlaygroundClient />
      </div>
    </Shell>
  );
}
