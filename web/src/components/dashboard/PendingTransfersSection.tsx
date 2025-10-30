"use client";

import React from "react";

export type PendingRow = {
  id: number;
  from: string;
  to: string;
  tokenId: number;
  amount: bigint;
  dateCreated: number;
  status: number;
  tokenName?: string;
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
  return (
    <section id="pending-transfers" className="space-y-3 rounded-3xl border border-surface bg-surface-1 p-5 shadow-inner">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("dashboard.pendingTransfers.title")}</h3>
        <span className="rounded-full border border-surface px-2 py-0.5 text-[10px] font-semibold">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">{t("dashboard.pendingTransfers.empty")}</p>
      ) : (
        <ul className="grid gap-2">
          {items.map(tr => (
            <li key={tr.id} className="rounded-xl border border-surface bg-surface-2 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">#{tr.tokenId} · {tr.tokenName ?? "Token"} · {tr.amount.toString()}</p>
                  <p className="text-xs text-slate-500">{t("dashboard.pendingTransfers.from", { from: tr.from.slice(0,6)+"…"+tr.from.slice(-4) })}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onAccept(tr.id)} disabled={!!txBusy[tr.id]} className="rounded-full border border-emerald-400 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300">
                    {txBusy[tr.id] ? t("dashboard.pendingTransfers.processing") : t("dashboard.pendingTransfers.accept")}
                  </button>
                  <button onClick={() => onReject(tr.id)} disabled={!!txBusy[tr.id]} className="rounded-full border border-rose-400 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300">
                    {t("dashboard.pendingTransfers.reject")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
