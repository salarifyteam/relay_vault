"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function EndUserActions({
  endUserLabel,
  provider,
  isActive,
}: {
  endUserLabel: string;
  provider: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const revoke = async () => {
    if (!confirm(`Revoke ${endUserLabel}'s ${provider} key? They'll need to reconnect.`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/console/revoke-user-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endUserLabel, provider }),
      });
      if (r.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!isActive) {
    return <span style={{ color: "var(--ink-3)", fontSize: 13 }}>revoked</span>;
  }
  return (
    <Button variant="ghost" size="sm" onClick={revoke} disabled={busy}>
      {busy ? "…" : "Revoke"}
    </Button>
  );
}
