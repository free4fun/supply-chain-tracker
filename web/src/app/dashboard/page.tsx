// web/src/app/dashboard/page.tsx
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useWeb3 } from "@/contexts/Web3Context";
import { useRole } from "@/contexts/RoleContext";
import { useBlockWatcher } from "@/hooks/useBlockWatcher";
import { getUserTokens, getTokenBalance } from "@/lib/sc";
import { useI18n } from "@/contexts/I18nContext";

// Translation-driven panel configuration keeps copy in sync across languages.
type PanelConfig = {
  titleKey: string;
  nextRoleKey?: string;
  tipKeys: readonly string[];
  actions: readonly { href: string; labelKey: string }[];
};

const ROLE_PANELS: Record<string, PanelConfig> = {
  Producer: {
    titleKey: "roles.Producer",
    nextRoleKey: "roles.Factory",
    tipKeys: [
      "dashboard.roles.producer.tip1",
      "dashboard.roles.producer.tip2",
      "dashboard.roles.producer.tip3",
    ],
    actions: [
      { href: "/tokens/create", labelKey: "dashboard.roles.producer.actions.create" },
      { href: "/transfers", labelKey: "dashboard.roles.producer.actions.transfer" },
    ],
  },
  Factory: {
    titleKey: "roles.Factory",
    nextRoleKey: "roles.Retailer",
    tipKeys: [
      "dashboard.roles.factory.tip1",
      "dashboard.roles.factory.tip2",
      "dashboard.roles.factory.tip3",
    ],
    actions: [
      { href: "/tokens/create", labelKey: "dashboard.roles.factory.actions.create" },
      { href: "/transfers", labelKey: "dashboard.roles.factory.actions.transfer" },
    ],
  },
  Retailer: {
    titleKey: "roles.Retailer",
    nextRoleKey: "roles.Consumer",
    tipKeys: [
      "dashboard.roles.retailer.tip1",
      "dashboard.roles.retailer.tip2",
      "dashboard.roles.retailer.tip3",
    ],
    actions: [{ href: "/transfers", labelKey: "dashboard.roles.retailer.actions.transfer" }],
  },
  Consumer: {
    titleKey: "roles.Consumer",
    tipKeys: [
      "dashboard.roles.consumer.tip1",
      "dashboard.roles.consumer.tip2",
      "dashboard.roles.consumer.tip3",
    ],
    actions: [{ href: "/dashboard", labelKey: "dashboard.roles.consumer.actions.trace" }],
  },
} as const;

const ADMIN_PANEL: PanelConfig = {
  titleKey: "roles.Admin",
  tipKeys: [
    "dashboard.roles.admin.tip1",
    "dashboard.roles.admin.tip2",
    "dashboard.roles.admin.tip3",
  ],
  actions: [{ href: "/admin/users", labelKey: "dashboard.roles.admin.actions.manage" }],
};

export default function Dashboard() {
  const { t } = useI18n();
  const { account, mustConnect, error } = useWeb3();
  const { activeRole, isApproved, loading: roleLoading, statusLabel, isAdmin } = useRole();

  const [tokens, setTokens] = useState<number[]>([]);
  const [balances, setBalances] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  const refreshBalances = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!account || mustConnect) {
        setTokens([]);
        setBalances({});
        if (!silent) setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const ids = await getUserTokens(account);
        const nums = ids.map(Number);
        setTokens(nums);
        const balPairs = await Promise.all(
          nums.map(async (id: number) => {
            const bal = await getTokenBalance(id, account);
            return [id, bal.toString()] as const;
          })
        );
        setBalances(Object.fromEntries(balPairs));
      } catch (err: unknown) {
        console.error(err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [account, mustConnect]
  );

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  useBlockWatcher(() => refreshBalances({ silent: true }), [refreshBalances]);

  const panel = useMemo(() => {
    if (activeRole && (ROLE_PANELS as Record<string, PanelConfig | undefined>)[activeRole]) {
      return ROLE_PANELS[activeRole as keyof typeof ROLE_PANELS];
    }
    if (isAdmin) return ADMIN_PANEL;
    return undefined;
  }, [activeRole, isAdmin]);

  if (mustConnect) {
    return (
      <div className="rounded-3xl border border-surface bg-surface-1 p-6 text-sm text-slate-600 shadow-sm dark:text-slate-300">
        {t("dashboard.connectPrompt")}
      </div>
    );
  }

  if (error) return <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>;

  if (!roleLoading && !isApproved && !isAdmin) {
    return (
      <div className="space-y-3 rounded-3xl border border-amber-300/60 bg-amber-50/70 p-6 text-sm text-amber-900 shadow-sm dark:border-amber-300/40 dark:bg-amber-500/10 dark:text-amber-100">
        <p className="font-semibold">{t("dashboard.pending.title")}</p>
        <p>
          {t("dashboard.pending.message", { status: statusLabel ? translateStatus(statusLabel, t) : t("common.status.none") })}
          <Link href="/profile" className="ml-1 underline underline-offset-4">
            {t("nav.profile")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
  <section className="space-y-4 rounded-3xl border border-surface bg-surface-1 p-6 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t("dashboard.inventory.title")}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("dashboard.inventory.subtitle")}</p>
            </div>
            <button
              onClick={() => refreshBalances()}
              disabled={loading}
              className="rounded-full border border-surface px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-accent hover:text-accent disabled:opacity-60 dark:text-slate-200"
            >
              {loading ? t("dashboard.inventory.refreshing") : t("dashboard.inventory.refresh")}
            </button>
          </div>

          <div className="grid gap-3">
            {tokens.length === 0 && !loading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("dashboard.inventory.empty")}</p>
            ) : null}
            {tokens.map(id => (
              <div
                key={id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface bg-surface-2 px-4 py-3 shadow-sm hover:bg-surface-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("dashboard.inventory.token", { id })}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("dashboard.inventory.balanceLabel")}</p>
                </div>
                <span className="text-lg font-semibold text-indigo-600 dark:text-indigo-300">{balances[id] ?? "…"}</span>
              </div>
            ))}
          </div>
        </section>

        {panel ? (
          <aside className="space-y-4 rounded-3xl border border-surface bg-surface-1 p-6 shadow-inner">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t(panel.titleKey)}</h3>
              {panel.nextRoleKey ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("dashboard.panel.next", { role: t(panel.nextRoleKey) })}</p>
              ) : null}
            </div>
            <ul className="grid gap-2 text-sm text-slate-600 dark:text-slate-300">
              {panel.tipKeys.map(tipKey => (
                <li key={tipKey} className="rounded-xl border border-surface bg-surface-2 px-3 py-2 hover:bg-surface-3">
                  {t(tipKey)}
                </li>
              ))}
            </ul>
            {panel.actions.length ? (
              <div className="flex flex-wrap gap-2">
                {panel.actions.map(action => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="rounded-full bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                  >
                    {t(action.labelKey)}
                  </Link>
                ))}
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

// Helper reused to normalize status text according to the translation table.
function translateStatus(status: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const key = `admin.users.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}
