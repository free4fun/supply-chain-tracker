"use client";
import { useCallback, useEffect, useState } from "react";

import { useBlockWatcher } from "@/hooks/useBlockWatcher";
import { getTokenView } from "@/lib/sc";

type TokenRow = { id: number; name: string; supply: number; parentId: number };

export default function TokensPage() {
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [maxId, setMaxId] = useState(10);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!silent) setLoading(true);
      try {
        const acc: TokenRow[] = [];
        for (let i = 1; i <= maxId; i++) {
          try {
            const t = await getTokenView(i);
            acc.push({ id: Number(t[0]), name: t[2], supply: Number(t[3]), parentId: Number(t[5]) });
          } catch {
            // token inexistente
          }
        }
        setRows(acc);
      } catch (err: unknown) {
        console.error(err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [maxId]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useBlockWatcher(() => refresh({ silent: true }), [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Tokens</h1>
        <label className="text-sm text-slate-600 dark:text-slate-300">
          Explorar hasta ID
          <input
            className="ml-2 w-24 rounded-xl border border-slate-300/70 px-3 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            type="number"
            value={maxId}
            min={1}
            onChange={event => setMaxId(Math.max(1, Number(event.target.value)))}
          />
        </label>
        <button
          onClick={() => refresh()}
          disabled={loading}
          className="rounded-full border border-slate-300/70 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      <div className="grid gap-3">
        {rows.length === 0 && !loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No se encontraron tokens en el rango indicado.</p>
        ) : null}
        {rows.map(row => (
          <div
            key={row.id}
            className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/80"
          >
            <div className="text-sm font-semibold text-slate-900 dark:text-white">#{row.id} — {row.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Supply: {row.supply} · Parent: {row.parentId}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
