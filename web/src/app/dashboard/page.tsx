// web/src/app/dashboard/page.tsx
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useWeb3 } from "@/contexts/Web3Context";
import { useRole } from "@/contexts/RoleContext";
import { useBlockWatcher } from "@/hooks/useBlockWatcher";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getUserTokens, getTokenBalance, getUserTransfers, getTransfer, getTokenView, acceptTransfer, rejectTransfer, getUserCreatedSummary, getUserBalancesNonZero, getUserCreatedTokens } from "@/lib/sc";
import RecentTransfers, { type RecentItem } from "@/components/RecentTransfers";
import StatsSection from "@/components/dashboard/StatsSection";
import TimelineSection from "@/components/dashboard/TimelineSection";
import PendingTransfersSection from "@/components/dashboard/PendingTransfersSection";
import TokensSection from "@/components/dashboard/TokensSection";
import { useI18n } from "@/contexts/I18nContext";
import { useRoleTheme } from "@/hooks/useRoleTheme";
import { getErrorMessage } from "@/lib/errors";

export default function Dashboard() {
  const { t } = useI18n();
  useRequireAuth(); // Redirige a home si no hay cuenta
  const { account, mustConnect, error } = useWeb3();
  const { activeRole, isApproved, loading: roleLoading, statusLabel } = useRole();
  const { theme } = useRoleTheme();

  const [tokens, setTokens] = useState<number[]>([]);
  const [balances, setBalances] = useState<Record<number, string>>({});
  const [tokenNames, setTokenNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState<Array<{
    id: number;
    from: string;
    to: string;
    tokenId: number;
    amount: bigint;
    dateCreated: number;
    status: number;
    tokenName?: string;
    direction: "in" | "out";
  }>>([]);
  const [txBusy, setTxBusy] = useState<Record<number, boolean>>({});
  
  const [createdSummary, setCreatedSummary] = useState<{ createdCount: number; totalSupplySum: bigint; availableSum: bigint; totalConsumedInputs: bigint } | null>(null);
  const [inventorySummary, setInventorySummary] = useState<{ tokensWithBalance: number; totalBalance: bigint } | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [timelineCounts, setTimelineCounts] = useState<number[]>([]);
  const [timelineMode, setTimelineMode] = useState<"count" | "volume">("count");

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
        const entries = await Promise.all(
          nums.map(async (id: number) => {
            const [bal, name] = await Promise.all([
              getTokenBalance(id, account).catch(() => 0n as any),
              getTokenView(id).then(tv => String(tv[2])).catch(() => undefined),
            ]);
            const balStr = (typeof bal === 'bigint' ? bal : BigInt(bal)).toString();
            return { id, balStr, name };
          })
        );
        setBalances(Object.fromEntries(entries.map(e => [e.id, e.balStr])));
        const nameMap: Record<number, string> = {};
        for (const e of entries) if (e.name) nameMap[e.id] = e.name;
        setTokenNames(nameMap);
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

  // Load summaries for role dashboards
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!account || mustConnect) { 
        if (!cancel) { 
          setCreatedSummary(null); 
          setInventorySummary(null); 
        } 
        return; 
      }
      try {
        const [created, inv] = await Promise.all([
          getUserCreatedSummary(account).catch((err) => {
            console.error("getUserCreatedSummary error:", err);
            return null;
          }),
          getUserBalancesNonZero(account).catch((err) => {
            console.error("getUserBalancesNonZero error:", err);
            return null;
          }),
        ]);
        if (cancel) return;
        
        // If queries fail, set default empty state instead of null
        setCreatedSummary(created || { 
          createdCount: 0, 
          totalSupplySum: 0n, 
          availableSum: 0n, 
          totalConsumedInputs: 0n 
        });
        
        if (inv) {
          const total = inv.balances.reduce((acc, b) => acc + b, 0n as bigint);
          setInventorySummary({ tokensWithBalance: inv.ids.length, totalBalance: total });
        } else {
          setInventorySummary({ tokensWithBalance: 0, totalBalance: 0n });
        }
      } catch (err) {
        console.error("Dashboard summary load error:", err);
        if (!cancel) { 
          // Set defaults instead of null so UI shows something
          setCreatedSummary({ 
            createdCount: 0, 
            totalSupplySum: 0n, 
            availableSum: 0n, 
            totalConsumedInputs: 0n 
          });
          setInventorySummary({ tokensWithBalance: 0, totalBalance: 0n });
        }
      }
    })();
    return () => { cancel = true; };
  }, [account, mustConnect]);

  // Load recent activity (transfers + creations) and build timeline buckets for current month (by day)
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!account || mustConnect) { if (!cancel) { setRecent([]); setTimelineCounts([]); } return; }
      try {
        const [transferIds, createdTokenIds] = await Promise.all([
          getUserTransfers(account).catch(() => [] as bigint[]),
          getUserCreatedTokens(account).catch(() => [] as number[]),
        ]);
        const items: RecentItem[] = [];
        // Transfers
        for (const rawId of transferIds) {
          try {
            const id = Number(rawId);
            const v = await getTransfer(id);
            const to = String(v[2]);
            const tokenId = Number(v[3]);
            const date = Number(v[4]);
            const amount = BigInt(v[5]);
            const status = Number(v[6]) as 0 | 1 | 2;
            const direction: "in" | "out" = to.toLowerCase() === account.toLowerCase() ? "in" : "out";
            let tokenName: string | undefined = undefined;
            try {
              const tv = await getTokenView(tokenId);
              tokenName = String(tv[2]);
            } catch {}
            items.push({ type: "transfer", id, direction, status, tokenId, tokenName, amount, dateCreated: date });
          } catch {}
        }
        // Creations
        for (const tokenId of createdTokenIds) {
          try {
            const tv = await getTokenView(Number(tokenId));
            const name = String(tv[2]);
            const totalSupply = BigInt(tv[4]);
            const date = Number(tv[7]);
            items.push({ type: "creation", id: Number(tokenId), tokenId: Number(tokenId), tokenName: name, totalSupply, dateCreated: date });
          } catch {}
        }
        // Build timeline buckets for current calendar month (UTC), one bucket per day
        const now = new Date();
        const y = now.getUTCFullYear();
        const m = now.getUTCMonth(); // 0-11
        const monthStartSec = Math.floor(Date.UTC(y, m, 1) / 1000);
        const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        const buckets = Array.from({ length: daysInMonth }, () => 0);
        for (const it of items) {
          const idx = Math.floor((it.dateCreated - monthStartSec) / 86400);
          if (idx >= 0 && idx < daysInMonth) {
            if (timelineMode === "count") {
              buckets[idx] += 1;
            } else {
              if (it.type === "transfer") {
                const n = Number(it.amount);
                buckets[idx] += Number.isFinite(n) ? n : 0;
              } else {
                const n = Number(it.totalSupply);
                buckets[idx] += Number.isFinite(n) ? n : 0;
              }
            }
          }
        }
        items.sort((a,b) => b.dateCreated - a.dateCreated);
        if (!cancel) {
          setTimelineCounts(buckets);
          setRecent(items.slice(0, 5));
        }
      } catch (err) {
        console.error(err);
        if (!cancel) { setRecent([]); setTimelineCounts([]); }
      }
    })();
    return () => { cancel = true; };
  }, [account, mustConnect, timelineMode]);

  // Load pending transfers for this user (incoming and outgoing)
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!account || mustConnect) {
        if (!cancel) setPendingTransfers([]);
        return;
      }
      try {
        const ids: bigint[] = await getUserTransfers(account);
        const rows: Array<{ id: number; from: string; to: string; tokenId: number; amount: bigint; dateCreated: number; status: number; tokenName?: string; direction: "in" | "out" }>
          = [];
        for (const raw of ids) {
          try {
            const id = Number(raw);
            const v = await getTransfer(id);
            const status = Number(v[6]);
            const to = String(v[2]);
            const from = String(v[1]);
            const isPending = status === 0;
            const isIncoming = to.toLowerCase() === account.toLowerCase();
            const isOutgoing = from.toLowerCase() === account.toLowerCase();
            if (isPending && (isIncoming || isOutgoing)) {
              const tokenId = Number(v[3]);
              let tokenName: string | undefined = undefined;
              try {
                const tv = await getTokenView(tokenId);
                tokenName = String(tv[2]);
              } catch {}
              rows.push({
                id,
                from,
                to,
                tokenId,
                dateCreated: Number(v[4]),
                amount: BigInt(v[5]),
                status,
                tokenName,
                direction: isIncoming ? "in" : "out",
              });
            }
          } catch {}
        }
        if (!cancel) setPendingTransfers(rows.sort((a,b)=> b.dateCreated - a.dateCreated));
      } catch (err) {
        console.error(err);
        if (!cancel) setPendingTransfers([]);
      }
    })();
    return () => { cancel = true; };
  }, [account, mustConnect]);

  // Manual refresh: reload all on-chain sections in parallel
  const refreshAll = useCallback(async ({ silent }: { silent?: boolean } = {}) => {
    if (!account || mustConnect) {
      // Reset to empty state if not connected
      setTokens([]);
      setBalances({});
      setCreatedSummary({ createdCount: 0, totalSupplySum: 0n, availableSum: 0n, totalConsumedInputs: 0n });
      setInventorySummary({ tokensWithBalance: 0, totalBalance: 0n });
      setPendingTransfers([]);
      setRecent([]);
      return;
    }

    if (!silent) setRefreshing(true);
    try {
      await Promise.all([
        // Balances and owned tokens
        (async () => {
          await refreshBalances({ silent: true });
        })(),
        // Created/inventory summaries
        (async () => {
          try {
            const [created, inv] = await Promise.all([
              getUserCreatedSummary(account).catch((err) => {
                console.error("getUserCreatedSummary error:", err);
                return null;
              }),
              getUserBalancesNonZero(account).catch((err) => {
                console.error("getUserBalancesNonZero error:", err);
                return null;
              }),
            ]);
            setCreatedSummary(
              created || {
                createdCount: 0,
                totalSupplySum: 0n,
                availableSum: 0n,
                totalConsumedInputs: 0n,
              }
            );
            if (inv) {
              const total = inv.balances.reduce((acc, b) => acc + b, 0n as bigint);
              setInventorySummary({ tokensWithBalance: inv.ids.length, totalBalance: total });
            } else {
              setInventorySummary({ tokensWithBalance: 0, totalBalance: 0n });
            }
          } catch (err) {
            console.error("Dashboard summary load error:", err);
            setCreatedSummary({ createdCount: 0, totalSupplySum: 0n, availableSum: 0n, totalConsumedInputs: 0n });
            setInventorySummary({ tokensWithBalance: 0, totalBalance: 0n });
          }
        })(),
        // Recent activity and timeline (current month by day)
        (async () => {
          try {
            const [transferIds, createdTokenIds] = await Promise.all([
              getUserTransfers(account).catch(() => [] as bigint[]),
              getUserCreatedTokens(account).catch(() => [] as number[]),
            ]);
            const items: RecentItem[] = [];
            for (const rawId of transferIds) {
              try {
                const id = Number(rawId);
                const v = await getTransfer(id);
                const to = String(v[2]);
                const tokenId = Number(v[3]);
                const date = Number(v[4]);
                const amount = BigInt(v[5]);
                const status = Number(v[6]) as 0 | 1 | 2;
                const direction: "in" | "out" = to.toLowerCase() === account.toLowerCase() ? "in" : "out";
                let tokenName: string | undefined = undefined;
                try {
                  const tv = await getTokenView(tokenId);
                  tokenName = String(tv[2]);
                } catch {}
                items.push({ type: "transfer", id, direction, status, tokenId, tokenName, amount, dateCreated: date });
              } catch {}
            }
            // Add creations
            for (const tokenId of createdTokenIds) {
              try {
                const tv = await getTokenView(Number(tokenId));
                const name = String(tv[2]);
                const totalSupply = BigInt(tv[4]);
                const date = Number(tv[7]);
                items.push({ type: "creation", id: Number(tokenId), tokenId: Number(tokenId), tokenName: name, totalSupply, dateCreated: date });
              } catch {}
            }
            const now = new Date();
            const y = now.getUTCFullYear();
            const m = now.getUTCMonth();
            const monthStartSec = Math.floor(Date.UTC(y, m, 1) / 1000);
            const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
            const counts = Array.from({ length: daysInMonth }, () => 0);
            for (const it of items) {
              const idx = Math.floor((it.dateCreated - monthStartSec) / 86400);
              if (idx >= 0 && idx < daysInMonth) {
                if (timelineMode === "count") {
                  counts[idx] += 1;
                } else {
                  if (it.type === "transfer") {
                    const n = Number(it.amount);
                    counts[idx] += Number.isFinite(n) ? n : 0;
                  } else {
                    const n = Number(it.totalSupply);
                    counts[idx] += Number.isFinite(n) ? n : 0;
                  }
                }
              }
            }
            items.sort((a, b) => b.dateCreated - a.dateCreated);
            setTimelineCounts(counts);
            setRecent(items.slice(0, 5));
          } catch (err) {
            console.error(err);
            setRecent([]);
            setTimelineCounts([]);
          }
        })(),
        // Pending transfers (incoming and outgoing)
        (async () => {
          try {
            const ids: bigint[] = await getUserTransfers(account);
            const rows: Array<{
              id: number;
              from: string;
              to: string;
              tokenId: number;
              amount: bigint;
              dateCreated: number;
              status: number;
              tokenName?: string;
              direction: "in" | "out";
            }> = [];
            for (const raw of ids) {
              try {
                const id = Number(raw);
                const v = await getTransfer(id);
                const status = Number(v[6]);
                const to = String(v[2]);
                const from = String(v[1]);
                const isPending = status === 0;
                const isIncoming = to.toLowerCase() === account.toLowerCase();
                const isOutgoing = from.toLowerCase() === account.toLowerCase();
                if (isPending && (isIncoming || isOutgoing)) {
                  const tokenId = Number(v[3]);
                  let tokenName: string | undefined = undefined;
                  try {
                    const tv = await getTokenView(tokenId);
                    tokenName = String(tv[2]);
                  } catch {}
                  rows.push({
                    id,
                    from,
                    to,
                    tokenId,
                    dateCreated: Number(v[4]),
                    amount: BigInt(v[5]),
                    status,
                    tokenName,
                    direction: isIncoming ? "in" : "out",
                  });
                }
              } catch {}
            }
            setPendingTransfers(rows.sort((a, b) => b.dateCreated - a.dateCreated));
          } catch (err) {
            console.error(err);
            setPendingTransfers([]);
          }
        })(),
      ]);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [account, mustConnect, refreshBalances, timelineMode]);
  
  const handleAccept = useCallback(async (id: number) => {
    setTxBusy(prev => ({ ...prev, [id]: true }));
    try {
      await acceptTransfer(BigInt(id));
      // Optimistic update then full refresh of all on-chain sections
      setPendingTransfers(prev => prev.filter(t => t.id !== id));
      await refreshAll();
    } catch (err) {
      const message = getErrorMessage(err, "Error accepting transfer");
      if (message) console.error(message);
    } finally {
      setTxBusy(prev => ({ ...prev, [id]: false }));
    }
  }, [refreshAll]);

  const handleReject = useCallback(async (id: number) => {
    setTxBusy(prev => ({ ...prev, [id]: true }));
    try {
      await rejectTransfer(BigInt(id));
      setPendingTransfers(prev => prev.filter(t => t.id !== id));
      await refreshAll();
    } catch (err) {
      const message = getErrorMessage(err, "Error rejecting transfer");
      if (message) console.error(message);
    } finally {
      setTxBusy(prev => ({ ...prev, [id]: false }));
    }
  }, [refreshAll]);

  // Background refresh of all sections on each new block (silent, no header spinner)
  useBlockWatcher(() => { void refreshAll({ silent: true }); }, [refreshAll]);

  if (mustConnect) {
    return (
      <div className="rounded-3xl border border-surface bg-surface-1 p-6 text-sm text-slate-600 shadow-sm dark:text-slate-300">
        {t("dashboard.connectPrompt")}
      </div>
    );
  }

  if (error) return <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>;

  if (!roleLoading && !isApproved) {
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
    <div className={`space-y-6 rounded-[28px] border ${theme.accentBorder} ${theme.background} p-6 shadow-xl shadow-black/5`}>
      <header className={`rounded-3xl bg-gradient-to-r ${theme.gradient} px-6 py-5 text-white shadow-lg`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] opacity-80">{theme.label}</p>
            <h1 className="text-2xl font-semibold">{theme.icon} {t("dashboard.inventory.title")}</h1>
            <p className="mt-2 max-w-3xl text-sm opacity-90">{t("dashboard.inventory.subtitle")}</p>
          </div>
            <button
              type="button"
              onClick={() => refreshAll()}
              disabled={refreshing}
              className="rounded-full border border-white/60 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
            >
              {refreshing ? t("dashboard.inventory.refreshing") : t("dashboard.inventory.refresh")}
            </button>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Columna izquierda: apilado vertical */}
        <div className="space-y-6">
          <StatsSection
            createdSummary={createdSummary}
            inventorySummary={inventorySummary}
            pendingCount={pendingTransfers.length}
            activeRole={activeRole}
            t={t}
          />
          <PendingTransfersSection
            t={t}
            items={pendingTransfers}
            txBusy={txBusy}
            onAccept={handleAccept}
            onReject={handleReject}
          />
          <RecentTransfers items={recent} t={t} />
        </div>

        {/* Columna derecha: apilado vertical */}
        <div className="space-y-6">
          <TimelineSection
            t={t}
            counts={timelineCounts}
            mode={timelineMode}
            setMode={m => setTimelineMode(m)}
            barColor={theme.accentHex}
          />
          <TokensSection t={t} tokens={tokens} balances={balances} names={tokenNames} loading={loading} />
          
        </div>
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
