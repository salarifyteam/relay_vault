"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Card, KeyField, Button } from "@/components/ui";

export function ApiKeyCard({
  initialKey,
  initialMasked,
}: {
  initialKey: string;
  initialMasked: string;
}) {
  const [key, setKey] = useState(initialKey);
  const [masked, setMasked] = useState(initialMasked);
  const [busy, setBusy] = useState(false);

  const regenerate = async () => {
    if (!confirm("Regenerate the key? Your current key stops working immediately.")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/console/regenerate-key", { method: "POST" });
      const j = await r.json();
      if (r.ok) {
        setKey(j.rlyKey);
        setMasked(j.rlyKeyMasked);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="API key"
      desc="Use this key on your backend to issue registration tokens and proxy requests."
      action={
        <Button variant="secondary" size="sm" onClick={regenerate} disabled={busy}>
          <RefreshCw size={13} />
          {busy ? "…" : "Regenerate"}
        </Button>
      }
    >
      <KeyField key={key} value={key} masked={masked} />
    </Card>
  );
}
