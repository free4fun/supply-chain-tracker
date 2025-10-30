"use client";

import React from "react";
import Timeline from "@/components/Timeline";

export default function TimelineSection({
  t,
  counts,
  mode,
  setMode,
  barColor,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
  counts: number[];
  mode: "count" | "volume";
  setMode: (m: "count" | "volume") => void;
  barColor: string;
}) {
  const total = counts.length ? counts.reduce((a, b) => a + b, 0) : 0;
  return (
    <section className="space-y-3 rounded-3xl border border-surface bg-surface-1 p-5 shadow-inner">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("dashboard.activity.timeline")}</h3>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-surface overflow-hidden text-xs">
            <button onClick={() => setMode('count')} className={`px-2 py-0.5 ${mode === 'count' ? 'bg-surface-3 font-semibold' : ''}`}>{t('dashboard.activity.mode.count')}</button>
            <button onClick={() => setMode('volume')} className={`px-2 py-0.5 ${mode === 'volume' ? 'bg-surface-3 font-semibold' : ''}`}>{t('dashboard.activity.mode.volume')}</button>
          </div>
          <span className="rounded-full border border-surface px-2 py-0.5 text-[10px] font-semibold">{total}</span>
        </div>
      </div>
      <div className="mt-1 flex justify-center">
        <Timeline counts={counts} height={96} barColor={barColor} />
      </div>
    </section>
  );
}
