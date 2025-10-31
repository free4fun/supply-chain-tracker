"use client";


import { useRoleTheme } from "@/hooks/useRoleTheme";
import StatsCard from "../StatsCard";

export type CreatedSummary = {
  createdCount: number;
  totalSupplySum: bigint;
  availableSum: bigint;
  totalConsumedInputs: bigint;
} | null;

export type InventorySummary = {
  tokensWithBalance: number;
  totalBalance: bigint;
} | null;

export default function StatsSection({
  createdSummary,
  inventorySummary,
  pendingCount,
  activeRole,
  t,
}: {
  createdSummary: CreatedSummary;
  inventorySummary: InventorySummary;
  pendingCount: number;
  activeRole?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
    const { theme } = useRoleTheme();
  return (
    <section className={`grid gap-3 rounded-3xl border bg-white dark:bg-slate-900 p-6 shadow-inner md:grid-cols-3 relative ${theme.containerBorder}`}>
      {createdSummary !== null ? (
        <>
          <StatsCard label={t("dashboard.stats.createdCount")} value={createdSummary.createdCount} />
          <StatsCard label={t("dashboard.stats.totalSupply")} value={createdSummary.totalSupplySum} />
          <StatsCard label={t("dashboard.stats.availableSupply")} value={createdSummary.availableSum} />
          {/* Extra KPIs powered by on-chain views */}
          {activeRole === "Factory" || activeRole === "Retailer" ? (
            <StatsCard label={t("dashboard.stats.inputsConsumed")} value={createdSummary.totalConsumedInputs} />
          ) : (
            <StatsCard label={t("dashboard.stats.pendingTransfers")} value={pendingCount} />
          )}
          {inventorySummary ? (
            <>
              <StatsCard label={t("dashboard.stats.tokensWithBalance")} value={inventorySummary.tokensWithBalance}  />
              <StatsCard label={(activeRole === "Producer" || activeRole === "Consumer") ? t("dashboard.stats.heldBalance") : t("dashboard.stats.totalBalance")} value={inventorySummary.totalBalance} />
            </>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-slate-500">{t("common.loading.sync")}</p>
      )}
    </section>
  );
}
