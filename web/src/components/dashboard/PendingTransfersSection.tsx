"use client";

import React, { useState } from "react";
import { useRoleTheme } from "@/hooks/useRoleTheme";
import TokenDetailModal from "@/components/TokenDetailModal";
import { getTokenDetail } from "@/lib/tokenDetail";
import { useWeb3 } from "@/contexts/Web3Context";

export type PendingRow = {
  id: number;
  from: string;
  to: string;
  tokenId: number;
  amount: bigint;
  dateCreated: number;
  status: number;
  tokenName?: string;
  direction: "in" | "out";
};

export default function PendingTransfersSection({
  t,
  items,
  txBusy,
  onAccept,
  onReject,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
  items: PendingRow[];
  txBusy: Record<number, boolean>;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const { theme } = useRoleTheme();
  const { account } = useWeb3();
  const [modalTokenId, setModalTokenId] = useState<number | null>(null);
  return (
    <section id="pending-transfers" className={`space-y-3 rounded-3xl border ${theme.accentBorder} bg-white dark:bg-slate-900 p-5 shadow-inner`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-slate-700 dark:text-slate-300">{t("dashboard.pendingTransfers.title")}</h2>
        <span className="rounded-full border border-surface px-2 py-0.5 text-[10px] font-semibold">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">{t("dashboard.pendingTransfers.empty")}</p>
      ) : (
        <ul className="grid gap-2">
          {items.map(tr => (
            <li key={tr.id} className="rounded-xl border border-surface bg-surface-2 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div 
                  onClick={() => setModalTokenId(tr.tokenId)}
                  className="hover:bg-surface-3 rounded cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tr.direction === 'in' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300' : 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-300'}`}>
                      {tr.direction === 'in' ? t('dashboard.activity.in') : t('dashboard.activity.out')}
                    </span>
                    <p className="font-semibold">#{tr.tokenId} · {tr.tokenName ?? "Token"} · {tr.amount.toString()}</p>
                  </div>
                  {tr.direction === 'in' ? (
                    <p className="text-xs text-slate-500">{t("dashboard.pendingTransfers.from", { from: tr.from.slice(0,6)+"…"+tr.from.slice(-4) })}</p>
                  ) : (
                    <p className="text-xs text-slate-500">{t("dashboard.pendingTransfers.to", { to: tr.to.slice(0,6)+"…"+tr.to.slice(-4) })}</p>
                  )}
                </div>
                {tr.direction === 'in' ? (
                  <div className="flex gap-2">
                    <button onClick={() => onAccept(tr.id)} disabled={!!txBusy[tr.id]} className="rounded-full border border-emerald-400 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300">
                      {txBusy[tr.id] ? t("dashboard.pendingTransfers.processing") : t("dashboard.pendingTransfers.accept")}
                    </button>
                    <button onClick={() => onReject(tr.id)} disabled={!!txBusy[tr.id]} className="rounded-full border border-rose-400 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300">
                      {t("dashboard.pendingTransfers.reject")}
                    </button>
                  </div>
                ) : (
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-300">{t('dashboard.status.Pending')}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <TokenDetailModal
        tokenId={modalTokenId}
        onClose={() => setModalTokenId(null)}
        fetchDetail={(id) => getTokenDetail(id, account)}
      />
    </section>
  );
}
