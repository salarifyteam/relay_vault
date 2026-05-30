"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/console/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        router.push("/console");
      } else {
        setErr(j?.error?.message || `Failed (HTTP ${r.status})`);
        setBusy(false);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <button
        onClick={accept}
        disabled={busy}
        style={{
          padding: "10px 16px",
          background: "#635bff",
          color: "#fff",
          border: 0,
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Joining…" : "Accept and join"}
      </button>
      {err && <p style={{ color: "#e5484d", fontSize: 13, marginTop: 10 }}>{err}</p>}
    </div>
  );
}
