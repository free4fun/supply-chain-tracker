"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useRole } from "@/contexts/RoleContext";
import { useI18n } from "@/contexts/I18nContext";
import { useWeb3 } from "@/contexts/Web3Context";
import { useRoleTheme } from "@/hooks/useRoleTheme";

export default function Nav() {
  const pathname = usePathname();
  const { account, disconnect } = useWeb3();
  const { activeRole, company, firstName, lastName } = useRole();
  const { theme } = useRoleTheme();
  const { t, lang, available, setLanguage } = useI18n();

  const ROLE_LINKS: Record<string, { href: string; labelKey: string }[]> = {
    Producer: [
        { href: "/dashboard", labelKey: "nav.dashboard" },
        { href: "/tokens", labelKey: "nav.viewTokens" },
        { href: "/tokens/create", labelKey: "nav.createToken" },
        { href: "/transfers", labelKey: "nav.viewTransfers" },
    ],
    Factory: [
        { href: "/dashboard", labelKey: "nav.dashboard" },
        { href: "/tokens", labelKey: "nav.viewTokens" },
        { href: "/tokens/create", labelKey: "nav.createToken" },
        { href: "/transfers", labelKey: "nav.viewTransfers" },
    ],
    Retailer: [
        { href: "/dashboard", labelKey: "nav.dashboard" },
        { href: "/tokens", labelKey: "nav.viewTokens" },
        { href: "/tokens/create", labelKey: "nav.createToken" },
        { href: "/transfers", labelKey: "nav.viewTransfers" },
    ],
    Consumer: [
        { href: "/dashboard", labelKey: "nav.dashboard" },
        { href: "/tokens", labelKey: "nav.viewTokens" },
        { href: "/transfers", labelKey: "nav.viewTransfers" },
    ],
};

  const contactName = account ? [firstName, lastName].filter(Boolean).join(" ") : "";
  const displayCompany = account ? (company || t("landing.connection.role.none")) : t("landing.connection.role.none");
  const displayContact = account ? (contactName || t("landing.connection.role.requestAccess")) : t("landing.connection.role.requestAccess");
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

  return (
    <header className={`rounded-3xl border ${theme.accentBorder} bg-white dark:bg-slate-900 px-3 shadow-lg backdrop-blur`}>
      <nav className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-200">
         {activeRole && ROLE_LINKS[activeRole] ? (
            ROLE_LINKS[activeRole].map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    isActive
                      ? `bg-gradient-to-r ${theme.gradient} !text-white shadow-md`
                      : "border border-surface text-slate-600 hover:border-accent hover:text-accent dark:text-slate-200"
                  }`}
                >
                  {t(link.labelKey)}
                </Link>
              );
            })
          ) : (
            <Link
              href="/home"
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                pathname === "/home"
                  ? `bg-gradient-to-r ${theme.gradient} !text-white shadow-md`
                  : "border border-surface text-slate-600 hover:border-accent hover:text-accent dark:text-slate-200"
              }`}
            >
              {t("nav.home")}
            </Link>
          )}

        <div className="ml-auto flex items-center gap-2">
          {account && (
            <button
              type="button"
              onClick={disconnect}
              className="rounded-full border border-surface px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-rose-500 hover:text-rose-500 dark:text-slate-200"
              title={t("nav.disconnect") ?? "Disconnect"}
            >
              🔌
            </button>
          )}
          <button
            type="button"
            onClick={toggleDark}
            className="rounded-full border border-surface px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-accent hover:text-accent dark:text-slate-200"
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
            className="rounded-full border border-surface px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-accent hover:text-accent dark:text-slate-200"
            title={lang === "en" ? "Cambiar a Español" : "Switch to English"}
          >
            {lang === "en" ? "🇪🇸" : "🇺🇸"}
          </button>
          <Link href={`/profile`}>
            <div className="hidden rounded-full bg-surface-2 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition hover:bg-surface-3 hover:shadow-md md:flex md:flex-row md:items-center md:gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${theme.gradient} text-sm text-white shadow-md`}>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="currentColor" 
                  className="h-5 w-5"
                >
                  <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex flex-col items-start">
                <span className="font-semibold">{displayCompany}</span>
                <span className="text-[10px] font-normal uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">
                  {displayContact}
                </span>
              </div>
            </div>
          </Link>
          
        </div>
      </nav>
    </header>
  );
}
