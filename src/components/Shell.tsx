"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  KeyRound,
  Users,
  ChartBar,
  BookOpen,
  Wallet,
  UserPlus,
  Settings,
  ChevronDown,
  LogOut,
  Zap,
} from "lucide-react";
import s from "./Shell.module.css";
import { TenantPicker, type TenantPickerItem } from "./TenantPicker";

const NAV = [
  { href: "/console", label: "Home", icon: House },
  { href: "/console/keys", label: "API keys", icon: KeyRound },
  { href: "/console/playground", label: "Playground", icon: Zap },
  { href: "/console/users", label: "End-users", icon: Users },
  { href: "/console/usage", label: "Usage", icon: ChartBar },
  { href: "/console/billing", label: "Billing", icon: Wallet },
  { href: "/console/members", label: "Members", icon: UserPlus },
  { href: "/console/docs", label: "Docs", icon: BookOpen },
];

export type ShellAccount = {
  name?: string;
  email: string;
  picture?: string;
};

export function Shell({
  title,
  account,
  tenant,
  tenants,
  children,
}: {
  title: string;
  account: ShellAccount;
  tenant?: TenantPickerItem;
  tenants?: TenantPickerItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const display = account.name || account.email.split("@")[0];
  const initial = display.charAt(0).toUpperCase();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className={s.shell}>
      <aside className={s.sidebar}>
        <div className={s.brand}>
          <span className={s.brandMark}>◆</span>
          Relay
        </div>
        <nav className={s.nav}>
          {NAV.map((item) => {
            const active =
              item.href === "/console"
                ? pathname === "/console"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${s.navItem} ${active ? s.navActive : ""}`}
              >
                <Icon size={16} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className={s.navSpacer} />
        <div className={s.navDivider} />
        <Link href="/console/settings" className={s.navItem}>
          <Settings size={16} strokeWidth={2} />
          Settings
        </Link>
      </aside>

      <div className={s.main}>
        <header className={s.topbar}>
          <span className={s.topTitle}>{title}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {tenant && tenants && <TenantPicker current={tenant} tenants={tenants} />}
            <span className={s.planBadge}>● Bootstrap mode</span>
            <div className={s.accountWrap}>
              <button className={s.account} onClick={() => setMenuOpen((o) => !o)}>
                {account.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={s.avatarImg} src={account.picture} alt="" />
                ) : (
                  <span className={s.avatar}>{initial}</span>
                )}
                {display}
                <ChevronDown size={14} />
              </button>
              {menuOpen && (
                <div className={s.menu}>
                  <div className={s.menuEmail}>{account.email}</div>
                  <button className={s.menuItem} onClick={logout}>
                    <LogOut size={14} />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className={s.content}>{children}</main>
      </div>
    </div>
  );
}

export { s as shellStyles };
