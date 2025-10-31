// web/src/components/RecentTransfers.tsx
"use client";

import React, { useMemo, useState } from "react";
import TokenDetailModal from "@/components/TokenDetailModal";
import { getTokenDetail } from "@/lib/tokenDetail";
import { useWeb3 } from "@/contexts/Web3Context";
import { TokenTxHash } from "@/components/TokenTxHash";
import { useRoleTheme } from "@/hooks/useRoleTheme";
import { useI18n } from "@/contexts/I18nContext";

function formatDate(ts: number, locale: string): string {
  if (!ts) return "-";
  try {
    return new Date(ts * 1000).toLocaleString(locale, { timeZone: "UTC" });
  } catch {
    return String(ts);
  }
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

export default function RecentTransfers({ items }: { items: RecentItem[] }) {
  const { account } = useWeb3();
  const { theme } = useRoleTheme();
  const { t, lang } = useI18n();
  const [modalTokenId, setModalTokenId] = useState<number | null>(null);
  const locale = useMemo(() => (lang === "es" ? "es-AR" : "en-US"), [lang]);
  return (
    <section className={`space-y-3 rounded-3xl border bg-white dark:bg-slate-900 p-5 shadow-inner ${theme.containerBorder}`}>
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
              const fallbackName = it.tokenName ?? t("tokens.common.fallbackNameShort", { id: it.tokenId });
              const summary = t("dashboard.activity.summary", {
                id: it.tokenId,
                name: fallbackName,
                amount: it.amount.toString(),
              });
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
                  className={`rounded-xl border bg-surface-2 p-3 text-sm hover:bg-surface-3 cursor-pointer transition ${theme.cardBorder} ${theme.cardHoverBorder} ${theme.cardHoverShadow}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="font-semibold">{summary}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 ${statusClass}`}>{statusLabel}</span>
                  </div>
                  <div className="mb-2">
                    <TokenTxHash tokenId={it.tokenId} chainId={31337} showFull={true} className="text-xs" />
                  </div>
                  <p className="text-xs text-slate-500">{dir} · {formatDate(it.dateCreated, locale)}</p>
                </li>
              );
            } else {
              const fallbackName = it.tokenName ?? t("tokens.common.fallbackNameShort", { id: it.tokenId });
              const summary = t("dashboard.activity.summary", {
                id: it.tokenId,
                name: fallbackName,
                amount: it.totalSupply.toString(),
              });
              // creation
              return (
                <li
                  key={`cr-${it.id}`}
                  onClick={() => setModalTokenId(it.tokenId)}
                  className={`rounded-xl border bg-surface-2 p-3 text-sm hover:bg-surface-3 cursor-pointer transition ${theme.cardBorder} ${theme.cardHoverBorder} ${theme.cardHoverShadow}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="font-semibold">{summary}</p>
                    <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:border-sky-500 dark:bg-sky-950 dark:text-sky-300 flex-shrink-0">
                      {t("dashboard.activity.badge.created")}
                    </span>
                  </div>
                  <div className="mb-2">
                    <TokenTxHash tokenId={it.tokenId} chainId={31337} showFull={true} className="text-xs" />
                  </div>
                  <p className="text-xs text-slate-500">{t("dashboard.activity.created")} · {formatDate(it.dateCreated, locale)}</p>
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
