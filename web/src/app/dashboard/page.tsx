// web/src/app/dashboard/page.tsx
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useWeb3 } from "@/contexts/Web3Context";
import { useRole } from "@/contexts/RoleContext";
import { useBlockWatcher } from "@/hooks/useBlockWatcher";
import { getUserTokens, getTokenBalance, getUserTransfers, getTransfer, getTokenView, acceptTransfer, rejectTransfer, getUserCreatedSummary, getUserBalancesNonZero } from "@/lib/sc";
import RecentTransfers, { type RecentItem } from "@/components/RecentTransfers";
import StatsSection from "@/components/dashboard/StatsSection";
import TimelineSection from "@/components/dashboard/TimelineSection";
import PendingTransfersSection from "@/components/dashboard/PendingTransfersSection";
import TokensSection from "@/components/dashboard/TokensSection";
import { useI18n } from "@/contexts/I18nContext";
import { useRoleTheme } from "@/hooks/useRoleTheme";
import QuickLinks from "@/components/dashboard/QuickLinks";

export default function Dashboard() {
  const { t } = useI18n();
  const { account, mustConnect, error } = useWeb3();
  const { activeRole, isApproved, loading: roleLoading, statusLabel } = useRole();
  const { theme } = useRoleTheme();

  const [tokens, setTokens] = useState<number[]>([]);
  const [balances, setBalances] = useState<Record<number, string>>({});
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
        const balPairs = await Promise.all(
          nums.map(async (id: number) => {
            const bal = await getTokenBalance(id, account);
            return [id, bal.toString()] as const;
          })
        );
        setBalances(Object.fromEntries(balPairs));
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

  // Load recent transfers (incoming and outgoing) and build timeline buckets for current month (by day)
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!account || mustConnect) { if (!cancel) { setRecent([]); setTimelineCounts([]); } return; }
      try {
        const ids: bigint[] = await getUserTransfers(account);
        const items: RecentItem[] = [];
        for (const rawId of ids) {
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
            items.push({ id, direction, status, tokenId, tokenName, amount, dateCreated: date });
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
              const n = Number(it.amount);
              buckets[idx] += Number.isFinite(n) ? n : 0;
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

  // Load pending transfers for this user (recipient)
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!account || mustConnect) {
        if (!cancel) setPendingTransfers([]);
        return;
      }
      try {
        const ids: bigint[] = await getUserTransfers(account);
        const rows: Array<{ id: number; from: string; to: string; tokenId: number; amount: bigint; dateCreated: number; status: number; tokenName?: string }>
          = [];
        for (const raw of ids) {
          try {
            const id = Number(raw);
            const v = await getTransfer(id);
            const status = Number(v[6]);
            const to = String(v[2]);
            if (status === 0 && to.toLowerCase() === account.toLowerCase()) {
              const tokenId = Number(v[3]);
              let tokenName: string | undefined = undefined;
              try {
                const tv = await getTokenView(tokenId);
                tokenName = String(tv[2]);
              } catch {}
              rows.push({
                id,
                from: String(v[1]),
                to,
                tokenId,
                dateCreated: Number(v[4]),
                amount: BigInt(v[5]),
                status,
                tokenName,
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
  const refreshAll = useCallback(async () => {
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

    setRefreshing(true);
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
        // Recent transfers and timeline (current month by day)
        (async () => {
          try {
            const ids: bigint[] = await getUserTransfers(account);
            const items: RecentItem[] = [];
            for (const rawId of ids) {
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
                items.push({ id, direction, status, tokenId, tokenName, amount, dateCreated: date });
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
                  const n = Number(it.amount);
                  counts[idx] += Number.isFinite(n) ? n : 0;
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
        // Pending transfers (recipient)
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
            }> = [];
            for (const raw of ids) {
              try {
                const id = Number(raw);
                const v = await getTransfer(id);
                const status = Number(v[6]);
                const to = String(v[2]);
                if (status === 0 && to.toLowerCase() === account.toLowerCase()) {
                  const tokenId = Number(v[3]);
                  let tokenName: string | undefined = undefined;
                  try {
                    const tv = await getTokenView(tokenId);
                    tokenName = String(tv[2]);
                  } catch {}
                  rows.push({
                    id,
                    from: String(v[1]),
                    to,
                    tokenId,
                    dateCreated: Number(v[4]),
                    amount: BigInt(v[5]),
                    status,
                    tokenName,
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
      setRefreshing(false);
    }
  }, [account, mustConnect, refreshBalances, timelineMode]);
  
  const handleAccept = useCallback(async (id: number) => {
    setTxBusy(prev => ({ ...prev, [id]: true }));
    try {
      await acceptTransfer(BigInt(id));
      // Refresh lists
      setPendingTransfers(prev => prev.filter(t => t.id !== id));
      await refreshBalances({ silent: true });
    } catch (err) {
      console.error(err);
    } finally {
      setTxBusy(prev => ({ ...prev, [id]: false }));
    }
  }, [refreshBalances]);

  const handleReject = useCallback(async (id: number) => {
    setTxBusy(prev => ({ ...prev, [id]: true }));
    try {
      await rejectTransfer(BigInt(id));
      setPendingTransfers(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setTxBusy(prev => ({ ...prev, [id]: false }));
    }
  }, []);

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
          <QuickLinks activeRole={activeRole} theme={theme} t={t} />
          <TimelineSection
            t={t}
            counts={timelineCounts}
            mode={timelineMode}
            setMode={m => setTimelineMode(m)}
            barColor={theme.accentHex}
          />
          <TokensSection t={t} tokens={tokens} balances={balances} loading={loading} />
          
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
