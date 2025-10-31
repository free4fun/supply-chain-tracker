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
    <section id="my-tokens" className={`space-y-4 rounded-3xl border bg-white dark:bg-slate-900 p-6 shadow-inner ${theme.containerBorder}`}>
      <h2 className="text-sm text-slate-700 dark:text-slate-300">{t("dashboard.inventory.title")}</h2>
      {tokens.length === 0 && !loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("dashboard.inventory.empty")}</p>
      ) : null}
      {tokens.map(id => (
        <div
          key={id}
          onClick={() => setModalTokenId(id)}
          className={`rounded-2xl border bg-surface-2 px-4 py-3 shadow-sm hover:bg-surface-3 cursor-pointer transition ${theme.cardBorder} ${theme.cardHoverBorder} ${theme.cardHoverShadow}`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {t("dashboard.inventory.token", { id })} · {names[id] ?? t("tokens.common.fallbackNameShort", { id })}
            </p>
            <div className="flex-shrink-0 flex flex-col items-end">
              <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{t("dashboard.inventory.balanceLabel")}</p>
              <span className="text-lg font-semibold text-accent dark:text-indigo-300">{balances[id] ?? "…"}</span>
            </div>
          </div>
          <div className="mt-1">
            <TokenTxHash tokenId={id} chainId={31337} showFull={true} className="text-xs" />
          </div>
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
