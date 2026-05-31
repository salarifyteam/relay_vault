import { redirect } from "next/navigation";
import { getCurrentDeveloper } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { shellPropsFromMe } from "@/lib/shellProps";
import { DocsContent } from "./DocsContent";

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const me = await getCurrentDeveloper();
  if (!me) redirect("/login");

  return (
    <Shell title="Docs" {...shellPropsFromMe(me)}>
      {/* 평문 키는 더 이상 보관하지 않으므로 플레이스홀더를 넣는다. 사용자가 keys 페이지에서 발급한 키로 교체. */}
      <DocsContent rly="rly_live_YOUR_KEY" />
    </Shell>
  );
}
