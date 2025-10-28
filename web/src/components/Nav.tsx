"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useRole } from "@/contexts/RoleContext";
import { useI18n } from "@/contexts/I18nContext";

type NavItem = {
  href: string;
  labelKey: string;
  requireApproved?: boolean;
  roles?: string[];
  adminOnly?: boolean;
  allowAdmin?: boolean;
};

const items: NavItem[] = [
  { href: "/", labelKey: "nav.home" },
  { href: "/dashboard", labelKey: "nav.dashboard", requireApproved: true },
  { href: "/tokens", labelKey: "nav.tokens" },
  {
    href: "/tokens/create",
    labelKey: "nav.create",
    requireApproved: true,
    roles: ["Producer", "Factory", "Retailer"],
    allowAdmin: true,
  },
  {
    href: "/transfers",
    labelKey: "nav.transfers",
    requireApproved: true,
    roles: ["Producer", "Factory", "Retailer"],
    allowAdmin: true,
  },
  { href: "/profile", labelKey: "nav.profile" },
  { href: "/admin", labelKey: "nav.admin", adminOnly: true },
  { href: "/admin/users", labelKey: "nav.adminUsers", adminOnly: true },
];

export default function Nav() {
  const pathname = usePathname();
  const { activeRole, isApproved, isAdmin, company, firstName, lastName } = useRole();
  const { t, lang, available, setLanguage } = useI18n();
  const allowedRole = activeRole ?? undefined;
  const contactName = [firstName, lastName].filter(Boolean).join(" ");
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return false;
      return localStorage.getItem("color-scheme") === "dark";
    } catch {
      return false;
    }
  });

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    const root = document.documentElement;
    root.classList.toggle("dark", next);
    try {
      localStorage.setItem("color-scheme", next ? "dark" : "light");
    } catch {}
  };

  const tabs = items.filter(item => {
    if (item.adminOnly) return isAdmin;
    if (item.requireApproved && !isApproved) {
      return false;
    }
    if (item.roles && item.roles.length > 0) {
      if (item.roles.includes(allowedRole || "")) return true;
      if (item.allowAdmin && isAdmin) return true;
      return false;
    }
    if (item.allowAdmin && isAdmin) return true;
    return true;
  });

  return (
    <header className="rounded-3xl border border-slate-200/70 bg-white/90 px-3 shadow-lg backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/90">
      <nav className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-200">
        {tabs.map(tab => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full px-4 py-2 transition ${
                isActive
                  ? "btn-primary"
                  : "text-slate-600 hover:text-accent hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-slate-800/60 dark:hover:text-accent"
              }`}
            >
              {t(tab.labelKey)}
            </Link>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-100 md:flex md:flex-col md:items-start">
            <span>{company || t("landing.connection.role.none")}</span>
            <span className="text-[10px] font-normal uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
              {contactName || t("landing.connection.role.requestAccess")}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleDark}
            className="rounded-full border border-slate-300/70 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-accent hover:text-accent dark:border-slate-600 dark:text-slate-200"
            title={isDark ? t("common.light") ?? "Light" : t("common.dark") ?? "Dark"}
            aria-label="Toggle dark mode"
          >
            {isDark ? "☀️" : "🌙"}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = available.find(code => code !== lang) ?? lang;
              setLanguage(next);
            }}
            className="rounded-full border border-slate-300/70 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-accent hover:text-accent dark:border-slate-600 dark:text-slate-200"
          >
            {t("nav.languageToggle", { lang: lang.toUpperCase() })}
          </button>
        </div>
      </nav>
    </header>
  );
}
