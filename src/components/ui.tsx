"use client";

import React, { useState } from "react";
import { Copy, Eye, EyeOff, Check } from "lucide-react";
import s from "./ui.module.css";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
};

export function Button({ variant = "primary", size = "md", className = "", ...rest }: BtnProps) {
  const v =
    variant === "primary" ? s.btnPrimary : variant === "secondary" ? s.btnSecondary : s.btnGhost;
  return <button className={`${s.btn} ${v} ${size === "sm" ? s.btnSm : ""} ${className}`} {...rest} />;
}

export function Card({
  title,
  desc,
  action,
  children,
}: {
  title?: string;
  desc?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={s.card}>
      {(title || action) && (
        <div className={s.cardHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            {title && <div className={s.cardTitle}>{title}</div>}
            {desc && <div className={s.cardDesc}>{desc}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={s.stat}>
      <div className={s.statLabel}>{label}</div>
      <div className={s.statValue}>{value}</div>
      {sub && <div className={s.statSub}>{sub}</div>}
    </div>
  );
}

export function StatCardGrid({ children }: { children: React.ReactNode }) {
  return <div className={s.statGrid}>{children}</div>;
}

export function StatusPill({ kind, children }: { kind: "success" | "danger" | "warn"; children: React.ReactNode }) {
  const c = kind === "success" ? s.pillSuccess : kind === "danger" ? s.pillDanger : s.pillWarn;
  return <span className={`${s.pill} ${c}`}>{children}</span>;
}

export function KeyField({ value, masked }: { value: string; masked: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className={s.keyField}>
      <span className={s.keyValue}>{revealed ? value : masked}</span>
      <button className={s.iconBtn} onClick={() => setRevealed((r) => !r)}>
        {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
        {revealed ? "Hide" : "Reveal"}
      </button>
      <button className={s.iconBtn} onClick={copy}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className={s.empty}>
      <div className={s.emptyTitle}>{title}</div>
      {children && <div style={{ fontSize: 13 }}>{children}</div>}
    </div>
  );
}

export function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* noop */
    }
  };
  return (
    <div style={{ position: "relative" }}>
      <button
        className={s.iconBtn}
        onClick={copy}
        style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.08)", color: "#cdd7e5", borderColor: "rgba(255,255,255,0.15)" }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className={s.code}>{children}</pre>
    </div>
  );
}

export { s as uiStyles };
