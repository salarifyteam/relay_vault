"use client";

import { useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Card, Button, KeyField, StatusPill, EmptyState, uiStyles } from "@/components/ui";

type Environment = "test" | "live";

export interface ApiKeyRow {
  id: string;
  environment: Environment;
  prefix: string;
  last4: string;
  name: string;
  status: "active" | "revoked";
  lastUsedAt?: string;
  createdAt: string;
}

// 방금 발급된 평문(1회 노출). 생성/롤 응답에서만 채워진다.
interface RevealedSecret {
  id: string;
  secret: string;
  environment: Environment;
}

export function ApiKeyManager({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [revealed, setRevealed] = useState<RevealedSecret | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const r = await fetch("/api/console/api-keys");
    if (r.ok) setKeys((await r.json()).keys);
  };

  const create = async (environment: Environment) => {
    setBusy(true);
    try {
      const r = await fetch("/api/console/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment, name: "default" }),
      });
      const j = await r.json();
      if (r.ok) {
        setRevealed({ id: j.id, secret: j.secret, environment: j.environment });
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const roll = async (id: string) => {
    if (!confirm("Roll this key? The current key stops working immediately.")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/console/api-keys/${id}/roll`, { method: "POST" });
      const j = await r.json();
      if (r.ok) {
        setRevealed({ id: j.id, secret: j.secret, environment: j.environment });
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this key? It stops working immediately and cannot be restored.")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/console/api-keys/${id}`, { method: "DELETE" });
      if (r.ok) {
        if (revealed?.id === id) setRevealed(null);
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {revealed && (
        <Card title="Copy your new key now">
          <p style={{ margin: "0 0 10px", color: "var(--ink-2)", fontSize: 13 }}>
            This is the only time the full <b>{revealed.environment}</b> key is shown. Store it
            somewhere safe — you won&apos;t be able to see it again.
          </p>
          <KeyField value={revealed.secret} masked={revealed.secret} />
        </Card>
      )}

      {(["live", "test"] as Environment[]).map((env) => (
        <EnvSection
          key={env}
          environment={env}
          keys={keys.filter((k) => k.environment === env)}
          busy={busy}
          onCreate={() => create(env)}
          onRoll={roll}
          onRevoke={revoke}
        />
      ))}
    </div>
  );
}

function EnvSection({
  environment,
  keys,
  busy,
  onCreate,
  onRoll,
  onRevoke,
}: {
  environment: Environment;
  keys: ApiKeyRow[];
  busy: boolean;
  onCreate: () => void;
  onRoll: (id: string) => void;
  onRevoke: (id: string) => void;
}) {
  const active = keys.filter((k) => k.status === "active");
  return (
    <Card
      title={environment === "live" ? "Live keys" : "Test keys"}
      desc={
        environment === "live"
          ? "Authenticate real traffic. Live usage counts toward billing."
          : "Exercise the API safely. Test traffic is isolated from live usage and limits."
      }
      action={
        <Button variant="secondary" size="sm" onClick={onCreate} disabled={busy}>
          <Plus size={13} />
          New {environment} key
        </Button>
      }
    >
      {active.length === 0 ? (
        <EmptyState title={`No ${environment} keys yet`}>
          Create one to start making {environment} requests.
        </EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {active.map((k) => (
            <div
              key={k.id}
              style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span className={uiStyles.cellMono}>
                  {k.prefix}••••{k.last4}
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{k.name}</span>
                <StatusPill kind={environment === "live" ? "success" : "warn"}>
                  {environment}
                </StatusPill>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Button variant="ghost" size="sm" onClick={() => onRoll(k.id)} disabled={busy}>
                  <RefreshCw size={13} />
                  Roll
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onRevoke(k.id)} disabled={busy}>
                  <Trash2 size={13} />
                  Revoke
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
