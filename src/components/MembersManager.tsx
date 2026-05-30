"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, StatusPill, uiStyles } from "@/components/ui";

interface Member {
  accountId: string;
  email: string;
  name?: string;
  role: "owner" | "member";
  joinedAt: string;
}

interface Invite {
  token: string;
  expiresAt: string;
  createdAt: string;
}

export function MembersManager({ canManage, currentAccountId }: { canManage: boolean; currentAccountId: string }) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const [newInvite, setNewInvite] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    const m = await fetch("/api/console/members").then((r) => r.json()).catch(() => ({ members: [] }));
    setMembers(m.members || []);
    if (canManage) {
      const i = await fetch("/api/console/invites").then((r) => r.json()).catch(() => ({ invites: [] }));
      setInvites(i.invites || []);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createInvite() {
    setBusy(true);
    try {
      const r = await fetch("/api/console/invites", { method: "POST" });
      const j = await r.json();
      if (r.ok) {
        setNewInvite({ url: j.inviteUrl, expiresAt: j.expiresAt });
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvite(token: string) {
    if (!confirm("Revoke this invite link?")) return;
    await fetch(`/api/console/invites?token=${encodeURIComponent(token)}`, { method: "DELETE" });
    await load();
  }

  async function removeMember(accountId: string, email: string) {
    if (!confirm(`Remove ${email} from this tenant?`)) return;
    await fetch(`/api/console/members?accountId=${accountId}`, { method: "DELETE" });
    await load();
    router.refresh();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <>
      {canManage && (
        <Card
          title="Invite a teammate"
          desc="Generate a one-time link (valid 7 days) and share it via Slack/email. They'll sign in with Google and join automatically as a member."
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button onClick={createInvite} disabled={busy}>
              {busy ? "Creating…" : "Create invite link"}
            </Button>
            {newInvite && (
              <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
                Expires {new Date(newInvite.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
          {newInvite && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 8,
                alignItems: "center",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "8px 10px",
                fontFamily: "var(--font-mono), monospace",
                fontSize: 13,
              }}
            >
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {newInvite.url}
              </span>
              <button className={uiStyles.iconBtn} onClick={() => copy(newInvite.url)}>
                {copied === newInvite.url ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </Card>
      )}

      <Card title="Members" desc="People who can access this tenant's console.">
        <table className={uiStyles.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              {canManage && <th style={{ textAlign: "right" }}></th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.accountId}>
                <td>{m.email}{m.accountId === currentAccountId ? " (you)" : ""}</td>
                <td>
                  {m.role === "owner" ? (
                    <StatusPill kind="success">owner</StatusPill>
                  ) : (
                    <span style={{ color: "var(--ink-3)" }}>member</span>
                  )}
                </td>
                <td style={{ color: "var(--ink-3)" }}>{new Date(m.joinedAt).toLocaleDateString()}</td>
                {canManage && (
                  <td style={{ textAlign: "right" }}>
                    {m.accountId !== currentAccountId && m.role !== "owner" ? (
                      <Button variant="ghost" size="sm" onClick={() => removeMember(m.accountId, m.email)}>
                        Remove
                      </Button>
                    ) : null}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {canManage && invites.length > 0 && (
        <Card title="Pending invites" desc="Links that haven't been used yet.">
          <table className={uiStyles.table}>
            <thead>
              <tr>
                <th>Link</th>
                <th>Expires</th>
                <th style={{ textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => {
                const url = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${i.token}`;
                return (
                  <tr key={i.token}>
                    <td className={uiStyles.cellMono} style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</td>
                    <td style={{ color: "var(--ink-3)" }}>{new Date(i.expiresAt).toLocaleDateString()}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className={uiStyles.iconBtn} onClick={() => copy(url)}>
                        {copied === url ? "Copied" : "Copy"}
                      </button>{" "}
                      <Button variant="ghost" size="sm" onClick={() => revokeInvite(i.token)}>
                        Revoke
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
