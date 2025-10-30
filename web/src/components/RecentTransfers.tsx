// web/src/components/RecentTransfers.tsx
"use client";

import React from "react";

function formatDate(ts: number): string {
  if (!ts) return "-";
  try { return new Date(ts * 1000).toLocaleString("en-US", { timeZone: "UTC" }); } catch { return String(ts); }
}

export type RecentItem = {
  id: number;
  direction: "in" | "out";
  status: 0 | 1 | 2; // Pending | Accepted | Rejected
  tokenId: number;
  tokenName?: string;
  amount: bigint;
  dateCreated: number;
};

export default function RecentTransfers({ items, t }: { items: RecentItem[]; t: (k: string, p?: Record<string, string | number>) => string }) {
  return (
    <section className="space-y-3 rounded-3xl border border-surface bg-surface-1 p-5 shadow-inner">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("dashboard.activity.title")}</h3>
        <span className="rounded-full border border-surface px-2 py-0.5 text-[10px] font-semibold">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">{t("dashboard.activity.empty")}</p>
      ) : (
        <ul className="grid gap-2">
          {items.map(it => {
            const dir = it.direction === "in" ? t("dashboard.activity.in") : t("dashboard.activity.out");
            const statusKey = it.status === 0 ? "Pending" : it.status === 1 ? "Accepted" : "Rejected";
            const statusLabel = t(`dashboard.status.${statusKey}`);
            const statusClass = it.status === 1 ? "text-emerald-700 border-emerald-300" : it.status === 2 ? "text-rose-700 border-rose-300" : "text-slate-700 border-slate-300";
            return (
              <li key={it.id} className="rounded-xl border border-surface bg-surface-2 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">#{it.tokenId} · {it.tokenName ?? "Token"} · {it.amount.toString()}</p>
                    <p className="text-xs text-slate-500">{dir} · {formatDate(it.dateCreated)}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>{statusLabel}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
