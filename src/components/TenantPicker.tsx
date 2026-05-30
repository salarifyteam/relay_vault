"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
import s from "./TenantPicker.module.css";

export interface TenantPickerItem {
  _id: string;
  name: string;
  role: "owner" | "member";
}

export function TenantPicker({
  current,
  tenants,
}: {
  current: TenantPickerItem;
  tenants: TenantPickerItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const onlyOne = tenants.length <= 1;

  async function pick(t: TenantPickerItem) {
    if (t._id === current._id || busy) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/console/switch-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: t._id }),
      });
      if (r.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.wrap} ref={ref}>
      <button
        className={s.trigger}
        onClick={() => !onlyOne && setOpen((o) => !o)}
        disabled={onlyOne}
        aria-label="Switch tenant"
      >
        <span className={s.name}>{current.name}</span>
        {!onlyOne && <ChevronDown size={13} />}
      </button>
      {open && !onlyOne && (
        <div className={s.menu}>
          {tenants.map((t) => (
            <button key={t._id} className={s.item} onClick={() => pick(t)}>
              <span>{t.name}</span>
              <span className={s.role}>{t.role}</span>
              {t._id === current._id && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
