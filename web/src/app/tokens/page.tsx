"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useBlockWatcher } from "@/hooks/useBlockWatcher";
import { getTokenBalance, getTokenView, getSuggestedParent, nextTokenId } from "@/lib/sc";
import { useRole } from "@/contexts/RoleContext";
import { useWeb3 } from "@/contexts/Web3Context";
import { useI18n } from "@/contexts/I18nContext";

type TokenRow = {
  id: number;
  name: string;
  description: string;
  supply: number;
  parentId: number;
  creator: string;
  features: string;
  createdAt: number;
};

type TraceNode = { id: number; name: string; description: string };

const TRANSFER_ROLES = new Set(["Producer", "Factory", "Retailer"]);

export default function TokensPage() {
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [trace, setTrace] = useState<TraceNode[]>([]);
  const [balance, setBalance] = useState<string>("0");
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [suggestedParent, setSuggestedParent] = useState<bigint>(0n);

  const { t } = useI18n();
  const { account } = useWeb3();
  const { activeRole, isApproved } = useRole();

  const refresh = useCallback(async ({ silent }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      const nextId = await nextTokenId();
      const acc: TokenRow[] = [];
      for (let i = 1; i < nextId; i++) {
        try {
          const token = await getTokenView(i);
          acc.push({
            id: Number(token[0]),
            creator: token[1],
            name: token[2],
            description: token[3],
            supply: Number(token[4]),
            features: token[5],
            parentId: Number(token[6]),
            createdAt: Number(token[7]),
          });
        } catch (err) {
          console.error(err);
        }
      }
      setRows(acc);
      if (acc.length > 0) {
        const firstId = acc[0].id;
        setSelectedId(current => (current && acc.some(token => token.id === current) ? current : firstId));
      } else {
        setSelectedId(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useBlockWatcher(() => refresh({ silent: true }), [refresh]);

  useEffect(() => {
    if (!account) {
      setSuggestedParent(0n);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await getSuggestedParent(account);
        if (!cancelled) setSuggestedParent(BigInt(raw));
      } catch (err) {
        console.error(err);
        if (!cancelled) setSuggestedParent(0n);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account, activeRole]);

  const tokensById = useMemo(() => Object.fromEntries(rows.map(row => [row.id, row])), [rows]);

  useEffect(() => {
    if (!selectedId) {
      setTrace([]);
      return;
    }
    const path: TraceNode[] = [];
    let cursor: number | undefined | null = selectedId;
    const safety = new Set<number>();
    while (cursor && cursor > 0 && !safety.has(cursor)) {
      safety.add(cursor);
      const node = tokensById[cursor];
      if (!node) break;
      path.push({ id: node.id, name: node.name, description: node.description });
      cursor = node.parentId;
    }
    if (cursor === 0) {
      path.push({ id: 0, name: t("tokens.trace.root"), description: "" });
    }
    setTrace(path);
  }, [selectedId, tokensById, t]);

  useEffect(() => {
    if (!account || !selectedId) {
      setBalance("0");
      return;
    }
    let cancelled = false;
    setBalanceLoading(true);
    getTokenBalance(selectedId, account)
      .then(value => {
        if (!cancelled) setBalance(value.toString());
      })
      .catch(err => {
        console.error(err);
        if (!cancelled) setBalance("0");
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account, selectedId]);

  const selectedToken = selectedId ? tokensById[selectedId] : undefined;

  const canTransfer = Boolean(
    account &&
      isApproved &&
      selectedToken &&
      activeRole &&
      TRANSFER_ROLES.has(activeRole) &&
      BigInt(balance || "0") > 0n
  );

  const canCreate = Boolean(
    selectedToken &&
      isApproved &&
      activeRole &&
      (activeRole === "Producer" || activeRole === "Factory")
  );

  const deriveAllowed = Boolean(
    canCreate &&
      activeRole === "Factory" &&
      selectedToken &&
      suggestedParent === BigInt(selectedToken.id)
  );

  const metadataPreview = useMemo(() => {
    if (!selectedToken?.features) return null;
    try {
      return JSON.stringify(JSON.parse(selectedToken.features), null, 2);
    } catch {
      return selectedToken.features;
    }
  }, [selectedToken]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t("tokens.title")}</h1>
        <button
          onClick={() => refresh()}
          disabled={loading}
          className="rounded-full border border-slate-300/70 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
        >
          {loading ? t("tokens.refreshing") : t("tokens.refresh")}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="space-y-3 rounded-3xl border border-slate-200/70 bg-white/90 p-4 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/80">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("tokens.list.title")}</h2>
          <div className="grid gap-2">
            {rows.length === 0 && !loading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("tokens.list.empty")}</p>
            ) : null}
            {rows.map(row => {
              const isActive = row.id === selectedId;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-indigo-400 bg-indigo-500/10 text-indigo-700 dark:border-indigo-500/60 dark:bg-indigo-500/10 dark:text-indigo-200"
                      : "border-slate-200/70 bg-white/80 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
                  }`}
                >
                  <span className="text-sm font-semibold">#{row.id} · {row.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t("tokens.list.parent", { parent: row.parentId })}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/80">
          {selectedToken ? (
            <>
              <header className="space-y-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{selectedToken.name}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {selectedToken.description || t("tokens.detail.noDescription")}
                </p>
                <dl className="grid grid-cols-2 gap-3 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-4">
                  <div>
                    <dt className="font-semibold uppercase tracking-wide">{t("tokens.detail.id")}</dt>
                    <dd>#{selectedToken.id}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide">{t("tokens.detail.parent")}</dt>
                    <dd>{selectedToken.parentId}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide">{t("tokens.detail.supply")}</dt>
                    <dd>{selectedToken.supply}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide">{t("tokens.detail.creator")}</dt>
                    <dd className="break-all">{selectedToken.creator}</dd>
                  </div>
                </dl>
              </header>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("tokens.actions.title")}</h3>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/transfers"
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      canTransfer
                        ? "bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-md shadow-indigo-500/30"
                        : "pointer-events-none border border-slate-200/70 text-slate-400 dark:border-slate-700 dark:text-slate-500"
                    }`}
                    aria-disabled={!canTransfer}
                  >
                    {t("tokens.actions.transfer")}
                  </Link>
                  <Link
                    href="/tokens/create"
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      canCreate && (activeRole === "Producer" || deriveAllowed)
                        ? "bg-gradient-to-r from-sky-500 to-emerald-500 text-white shadow-md shadow-emerald-500/30"
                        : "pointer-events-none border border-slate-200/70 text-slate-400 dark:border-slate-700 dark:text-slate-500"
                    }`}
                    aria-disabled={!(canCreate && (activeRole === "Producer" || deriveAllowed))}
                  >
                    {activeRole === "Producer"
                      ? t("tokens.actions.createRoot")
                      : t("tokens.actions.createDerived")}
                  </Link>
                </div>
                {!canTransfer && account && BigInt(balance || "0") === 0n ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("tokens.actions.transferHint")}</p>
                ) : null}
                {canCreate && activeRole === "Factory" && !deriveAllowed ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("tokens.actions.derivedHint")}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("tokens.detail.balance")}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {balanceLoading ? t("tokens.detail.balanceLoading") : t("tokens.detail.balanceValue", { value: balance })}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("tokens.detail.trace")}</h3>
                <ol className="grid gap-2 text-sm">
                  {trace.map(node => (
                    <li key={`${node.id}-${node.name}`} className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-2 dark:border-slate-700 dark:bg-slate-900/70">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {node.id === 0 ? t("tokens.trace.rootLabel") : `#${node.id} · ${node.name}`}
                      </span>
                      {node.description ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{node.description}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>

              {metadataPreview ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("tokens.detail.metadata")}</h3>
                  <pre className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                    {metadataPreview}
                  </pre>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("tokens.detail.empty")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
