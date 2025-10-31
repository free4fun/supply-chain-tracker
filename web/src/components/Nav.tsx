"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { useRole } from "@/contexts/RoleContext";
import { useI18n } from "@/contexts/I18nContext";
import { useWeb3 } from "@/contexts/Web3Context";
import { useRoleTheme } from "@/hooks/useRoleTheme";

export default function Nav() {
  const pathname = usePathname();
  const { account, disconnect } = useWeb3();
  const { activeRole, company, firstName, lastName, isAdmin } = useRole();
  const { theme } = useRoleTheme();
  const { t, lang, available, setLanguage } = useI18n();

  const roleLinks = useMemo(() => {
    const baseLinks = [
      { href: "/dashboard", labelKey: "nav.dashboard" },
      { href: "/tokens", labelKey: "nav.viewTokens" },
    ];
    return {
      Producer: [...baseLinks, { href: "/tokens/create", labelKey: "nav.createToken" }, { href: "/transfers", labelKey: "nav.viewTransfers" }],
      Factory: [...baseLinks, { href: "/tokens/create", labelKey: "nav.createToken" }, { href: "/transfers", labelKey: "nav.viewTransfers" }],
      Retailer: [...baseLinks, { href: "/tokens/create", labelKey: "nav.createToken" }, { href: "/transfers", labelKey: "nav.viewTransfers" }],
      Consumer: [...baseLinks, { href: "/transfers", labelKey: "nav.viewTransfers" }],
    } as Record<string, { href: string; labelKey: string }[]>;
  }, []);

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
    <header className={`rounded-3xl border bg-white dark:bg-slate-900 px-3 shadow-lg backdrop-blur ${theme.containerBorder}`}>
      <nav className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-200">
      {activeRole && roleLinks[activeRole] ? (
            roleLinks[activeRole].map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    isActive
                      ? `bg-gradient-to-r ${theme.gradient} !text-white shadow-md border-transparent`
                      : `${theme.linkBorder} ${theme.linkHoverBorder} ${theme.linkHoverShadow} text-slate-600 dark:text-slate-200`
                  }`}
                >
                  {t(link.labelKey)}
                </Link>
              );
            })
          ) : (
            <Link
              href="/home"
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                pathname === "/home"
                  ? `bg-gradient-to-r ${theme.gradient} !text-white shadow-md border-transparent`
                  : `${theme.linkBorder} ${theme.linkHoverBorder} ${theme.linkHoverShadow} text-slate-600 dark:text-slate-200`
              }`}
            >
              {t("nav.home")}
            </Link>
          )}

        {isAdmin ? (
          <>
            <Link
              href="/admin/users"
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                pathname === "/admin/users"
                  ? `bg-gradient-to-r ${theme.gradient} !text-white shadow-md border-transparent`
                  : `${theme.linkBorder} ${theme.linkHoverBorder} ${theme.linkHoverShadow} text-slate-600 dark:text-slate-200`
              }`}
            >
              {t("nav.adminUsers")}
            </Link>
            <Link
              href="/admin/settings"
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                pathname === "/admin/settings"
                  ? `bg-gradient-to-r ${theme.gradient} !text-white shadow-md border-transparent`
                  : `${theme.linkBorder} ${theme.linkHoverBorder} ${theme.linkHoverShadow} text-slate-600 dark:text-slate-200`
              }`}
            >
              {t("nav.adminSettings") ?? "Admin Settings"}
            </Link>
          </>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {account && (
            <button
              type="button"
              onClick={disconnect}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition text-slate-600 dark:text-slate-200 ${theme.linkBorder} hover:border-rose-500 hover:text-rose-500 hover:shadow-md hover:shadow-rose-200/30`}
              title={t("nav.disconnect") ?? "Disconnect"}
            >
              🔌
            </button>
          )}
          <button
            type="button"
            onClick={toggleDark}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition text-slate-600 dark:text-slate-200 ${theme.linkBorder} ${theme.linkHoverBorder} ${theme.linkHoverShadow}`}
            title={isDark ? t("common.theme.light") : t("common.theme.dark")}
            aria-label={t("nav.themeToggle")}
          >
            {isDark ? "☀️" : "🌙"}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = available.find(code => code !== lang) ?? lang;
              setLanguage(next);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition text-slate-600 dark:text-slate-200 ${theme.linkBorder} ${theme.linkHoverBorder} ${theme.linkHoverShadow}`}
            title={t("nav.languageToggleTooltip", { lang: lang === "en" ? "Español" : "English" })}
            aria-label={t("nav.languageToggle")}
          >
            {lang === "en" ? "🇪🇸" : "🇺🇸"}
          </button>
          <Link 
            href={`/profile`}
            className={`hidden rounded-full border bg-surface-2 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition md:flex md:flex-row md:items-center md:gap-3 ${theme.linkBorder} ${theme.linkHoverBorder} ${theme.linkHoverShadow}`}
          >
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
          </Link>
          
        </div>
      </nav>
    </header>
  );
}
