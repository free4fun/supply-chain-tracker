"use client";

import React from "react";

export default function TokensSection({
  t,
  tokens,
  balances,
  loading,
}: {
  t: (k: string, p?: Record<string, string | number>) => string;
  tokens: number[];
  balances: Record<number, string>;
  loading: boolean;
}) {
  return (
    <section id="my-tokens" className="space-y-4 rounded-3xl border border-surface bg-surface-1 p-6 shadow-inner">
      <h2 className="text-sm font-bold text-slate-700">Mis tokens</h2>
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
          <span className="text-lg font-semibold text-accent dark:text-indigo-300">{balances[id] ?? "…"}</span>
        </div>
      ))}
    </section>
  );
}
