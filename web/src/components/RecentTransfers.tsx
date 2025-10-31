// web/src/components/RecentTransfers.tsx
"use client";

import React, { useState } from "react";
import TokenDetailModal from "@/components/TokenDetailModal";
import { getTokenDetail } from "@/lib/tokenDetail";
import { useWeb3 } from "@/contexts/Web3Context";
import { TokenTxHash } from "@/components/TokenTxHash";

function formatDate(ts: number): string {
  if (!ts) return "-";
  try { return new Date(ts * 1000).toLocaleString("en-US", { timeZone: "UTC" }); } catch { return String(ts); }
}

export type RecentItem =
  | {
  type: "transfer";
  id: number; // transfer id
  direction: "in" | "out";
  status: 0 | 1 | 2 | 3; // Pending | Accepted | Rejected | Cancelled
      tokenId: number;
      tokenName?: string;
      amount: bigint;
      dateCreated: number;
    }
  | {
      type: "creation";
      id: number; // token id
      tokenId: number;
      tokenName?: string;
      totalSupply: bigint;
      dateCreated: number;
    };

export default function RecentTransfers({ items, t }: { items: RecentItem[]; t: (k: string, p?: Record<string, string | number>) => string }) {
  const { account } = useWeb3();
  const [modalTokenId, setModalTokenId] = useState<number | null>(null);
  return (
    <section className="space-y-3 rounded-3xl border border-surface bg-white dark:bg-slate-900 p-5 shadow-inner">
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-slate-700 dark:text-slate-300">{t("dashboard.activity.title")}</h2>
        <span className="rounded-full border border-surface px-2 py-0.5 text-[10px] font-semibold">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">{t("dashboard.activity.empty")}</p>
      ) : (
        <ul className="grid gap-2">
          {items.map(it => {
            if (it.type === "transfer") {
              const dir = it.direction === "in" ? t("dashboard.activity.in") : t("dashboard.activity.out");
              // Badge label per requirement
              const statusLabel = it.status === 0
                ? t("dashboard.status.Pending")
                : it.status === 1
                ? (it.direction === "in" ? t("dashboard.activity.status.received") : t("dashboard.activity.status.sent"))
                : it.status === 2
                ? (it.direction === "in" ? t("dashboard.activity.status.rejectedIn") : t("dashboard.activity.status.rejectedOut"))
                : t("dashboard.status.Cancelled");
              const statusClass = it.status === 0
                ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-300"
                : it.status === 1
                ? (it.direction === "in"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300" // Received
                  : "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-300") // Sent
                : it.status === 2
                ? (it.direction === "in"
                  ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950 dark:text-violet-300" // Declined (incoming)
                  : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500 dark:bg-rose-950 dark:text-rose-300") // Rejected (outgoing)
                : "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300"; // Cancelled
              return (
                <li 
                  key={`tr-${it.id}`}
                  onClick={() => setModalTokenId(it.tokenId)}
                  className="rounded-xl border border-surface bg-surface-2 p-3 text-sm hover:bg-surface-3 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        #{it.tokenId} · {it.tokenName ?? `Token ${it.tokenId}`} · {it.amount.toString()}
                      </p>
                      <div className="mt-1">
                        <TokenTxHash tokenId={it.tokenId} chainId={31337} />
                      </div>
                      <p className="text-xs mt-1 text-slate-500">{dir} · {formatDate(it.dateCreated)}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>{statusLabel}</span>
                  </div>
                </li>
              );
            } else {
              // creation
              return (
                <li 
                  key={`cr-${it.id}`}
                  onClick={() => setModalTokenId(it.tokenId)}
                  className="rounded-xl border border-surface bg-surface-2 p-3 text-sm hover:bg-surface-3 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        #{it.tokenId} · {it.tokenName ?? `Token ${it.tokenId}`} · {it.totalSupply.toString()}
                      </p>
                      <div className="mt-1">
                        <TokenTxHash tokenId={it.tokenId} chainId={31337} />
                      </div>
                      <p className="text-xs mt-1 text-slate-500">{t("dashboard.activity.created")} · {formatDate(it.dateCreated)}</p>
                    </div>
                    <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:border-sky-500 dark:bg-sky-950 dark:text-sky-300">
                      {t("dashboard.activity.badge.created")}
                    </span>
                  </div>
                </li>
              );
            }
          })}
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
