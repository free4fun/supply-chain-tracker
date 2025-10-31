"use client";

import { useRoleTheme } from "@/hooks/useRoleTheme";
import React, { useState } from "react";
import TokenDetailModal from "@/components/TokenDetailModal";
import { getTokenDetail } from "@/lib/tokenDetail";
import { TokenTxHash } from "@/components/TokenTxHash";

export default function TokensSection({
  t,
  tokens,
  balances,
  names,
  loading,
}: {
  t: (k: string, p?: Record<string, string | number>) => string;
  tokens: number[];
  balances: Record<number, string>;
  names: Record<number, string | undefined>;
  loading: boolean;
}) {
    const { theme } = useRoleTheme();
    const [modalTokenId, setModalTokenId] = useState<number | null>(null);

  return (
    <>
    <section id="my-tokens" className={`space-y-4 rounded-3xl border ${theme.accentBorder} bg-white dark:bg-slate-900 p-6 shadow-inner`}>
      <h2 className="text-sm text-slate-700 dark:text-slate-300">Mis tokens</h2>
      {tokens.length === 0 && !loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("dashboard.inventory.empty")}</p>
      ) : null}
      {tokens.map(id => (
        <div
          key={id}
          onClick={() => setModalTokenId(id)}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface bg-surface-2 px-4 py-3 shadow-sm hover:bg-surface-3 cursor-pointer"
        >
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">#{id} · {names[id] ?? `Token ${id}`}</p>
            <div className="mt-1">
              <TokenTxHash tokenId={id} chainId={31337} />
            </div>
            <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">{t("dashboard.inventory.balanceLabel")}</p>
          </div>
          <span className="text-lg font-semibold text-accent dark:text-indigo-300">{balances[id] ?? "…"}</span>
        </div>
      ))}
    </section>
    {modalTokenId && (
      <TokenDetailModal
        tokenId={modalTokenId}
        onClose={() => setModalTokenId(null)}
        fetchDetail={getTokenDetail}
      />
    )}
    </>
  );
}
