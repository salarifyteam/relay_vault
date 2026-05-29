"use client";

import { useState } from "react";
import { Card, Button } from "@/components/ui";

export function SpendCapEditor({ initial }: { initial?: number }) {
  const [value, setValue] = useState<string>(initial != null ? String(initial) : "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setSaved(false);
    try {
      const r = await fetch("/api/console/spend-cap", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultUserSpendCapUsd: value.trim() === "" ? null : Number(value) }),
      });
      if (r.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Default spend cap"
      desc="Max USD a single end-user's key can spend (estimated, per their own key). Leave empty for no cap. Applies to users without an individual cap."
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--ink-3)" }}>$</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="no cap"
            inputMode="decimal"
            style={{
              width: 120,
              height: 34,
              padding: "0 12px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 14,
              fontFamily: "var(--font-mono), monospace",
            }}
          />
        </div>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        {saved && <span style={{ color: "var(--success)", fontSize: 13 }}>Saved</span>}
      </div>
    </Card>
  );
}
