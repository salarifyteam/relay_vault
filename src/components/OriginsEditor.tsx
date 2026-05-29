"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Card, Button, uiStyles } from "@/components/ui";

export function OriginsEditor({ initial }: { initial: string[] }) {
  const [origins, setOrigins] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const add = () => {
    const v = draft.trim();
    if (v && !origins.includes(v)) setOrigins([...origins, v]);
    setDraft("");
  };
  const remove = (o: string) => setOrigins(origins.filter((x) => x !== o));

  const save = async () => {
    setBusy(true);
    setSaved(false);
    try {
      const r = await fetch("/api/console/origins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedOrigins: origins }),
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
      title="Allowed origins"
      desc="Domains where your key-connect widget is allowed to run (CORS). Leave empty to allow the local dev origin."
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="https://notemate.app"
          style={{
            flex: 1,
            height: 34,
            padding: "0 12px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontSize: 14,
            fontFamily: "var(--font-mono), monospace",
          }}
        />
        <Button variant="secondary" size="md" onClick={add}>
          <Plus size={14} />
          Add
        </Button>
      </div>

      {origins.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {origins.map((o) => (
            <div
              key={o}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "8px 10px",
                fontFamily: "var(--font-mono), monospace",
                fontSize: 13,
              }}
            >
              {o}
              <button
                className={uiStyles.iconBtn}
                onClick={() => remove(o)}
                style={{ border: "none", background: "transparent" }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save origins"}
        </Button>
        {saved && <span style={{ color: "var(--success)", fontSize: 13 }}>Saved</span>}
      </div>
    </Card>
  );
}
