import { redirect } from "next/navigation";
import { getCurrentDeveloper } from "@/lib/auth";
import { Shell, shellStyles } from "@/components/Shell";
import { shellPropsFromMe } from "@/lib/shellProps";
import { ApiKeyManager, type ApiKeyRow } from "@/components/ApiKeyManager";
import { Card } from "@/components/ui";
import ApiKey from "@/lib/models/ApiKey";
import { toApiKeyView } from "@/lib/services/apiKeyService";

export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const me = await getCurrentDeveloper();
  if (!me) redirect("/login");

  const docs = await ApiKey.find({ tenantId: me.tenant._id }).sort({ createdAt: -1 });
  // 직렬화: 서버 컴포넌트 → 클라이언트로 넘기려면 plain object여야 한다(Date는 ISO 문자열로).
  const keys: ApiKeyRow[] = docs.map((d) => {
    const v = toApiKeyView(d);
    return {
      ...v,
      lastUsedAt: v.lastUsedAt ? v.lastUsedAt.toISOString() : undefined,
      createdAt: v.createdAt.toISOString(),
    };
  });

  return (
    <Shell
      title="API keys"
      {...shellPropsFromMe(me)}
    >
      <div className={shellStyles.pageHead}>
        <h1 className={shellStyles.pageTitle}>API keys</h1>
        <p className={shellStyles.pageSub}>
          Separate keys for test and live. The key you use decides which environment a request
          runs in — test traffic never touches live usage, billing, or rate limits.
        </p>
      </div>

      <div className={shellStyles.stack}>
        <ApiKeyManager initialKeys={keys} />

        <Card title="Keep it secret">
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)", fontSize: 13, lineHeight: 1.9 }}>
            <li>Use these keys only on your <b>backend</b> — never ship them to the browser.</li>
            <li>They authenticate your app, not your users. Don&apos;t hand them to end-users.</li>
            <li>The full key is shown <b>once</b> at creation. If you lose it, roll the key.</li>
          </ul>
        </Card>
      </div>
    </Shell>
  );
}
