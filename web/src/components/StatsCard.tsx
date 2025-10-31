// web/src/components/StatsCard.tsx
"use client";

import React from "react";
import { useRoleTheme } from "@/hooks/useRoleTheme";

export function formatBigInt(n: bigint): string {
  try { return n.toLocaleString("es-AR"); } catch { return n.toString(); }
}

export default function StatsCard({
  label,
  value,
}: {
  label: string;
  value: string | number | bigint;
}) {
  const { theme } = useRoleTheme();
  const v = typeof value === "bigint" ? formatBigInt(value) : String(value);
  return (
    <div className={`rounded-2xl border bg-surface-2 p-4 shadow-sm text-center flex flex-col justify-center items-center cursor-default ${theme.containerBorder}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-accent">{v}</p>
    </div>
  );
}
