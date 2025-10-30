"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useBlockWatcher } from "@/hooks/useBlockWatcher";
import {
  getTokenBalance,
  getTokenInputs,
  getTokenView,
  getUserTokens,
  type TokenComponent,
} from "@/lib/sc";
import { useRole } from "@/contexts/RoleContext";
import { useWeb3 } from "@/contexts/Web3Context";
import { useI18n } from "@/contexts/I18nContext";
import { useRoleTheme } from "@/hooks/useRoleTheme";


type TokenDetail = {
  id: number;
  name: string;
  description: string;
  creator: string;
  totalSupply: bigint;
  availableSupply: bigint;
  parentId: number;
  createdAt: number;
  balance: bigint;
  metadata: Record<string, unknown> | null;
  features: string;
  inputs: TokenComponent[];
};

type TraceNode = {
  detail: TokenDetail;
  amount?: bigint;
  children: TraceNode[];
};

function parseMetadata(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, c => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function formatBigInt(value: bigint): string {
  return value.toLocaleString("es-AR");
}

function MetadataPanel({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return <p className="text-sm text-slate-500">Sin información adicional para este token.</p>;
  }
  return (
    <dl className="grid gap-3 md:grid-cols-2">
      {Object.entries(metadata).map(([key, value]) => (
        <div key={key} className="rounded-2xl border border-surface bg-surface-2 p-3 shadow-sm">
          <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{formatKey(key)}</dt>
          <dd className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function TraceTree({ node, depth = 0 }: { node: TraceNode; depth?: number }) {
  return (
    <li className="relative pl-6">
      {depth > 0 ? (
        <span className="absolute left-0 top-3 h-full border-l-2 border-surface" aria-hidden />
      ) : null}
      <div className="rounded-2xl border border-surface bg-surface-2 p-4 shadow-sm hover:bg-surface-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-800">#{node.detail.id} · {node.detail.name}</p>
            <p className="text-xs text-slate-500">{node.detail.description || "Sin descripción"}</p>
          </div>
            <div className="text-right text-xs text-slate-500">
              <p>Disponible global: {formatBigInt(node.detail.availableSupply)}</p>
              <p>Creado: {node.detail.createdAt ? new Date(node.detail.createdAt * 1000).toLocaleString("en-US", { timeZone: "UTC" }) : "-"}</p>
          </div>
        </div>
        {typeof node.amount !== "undefined" ? (
          <p className="mt-2 rounded-xl bg-surface-2 px-3 py-1 text-xs font-medium text-slate-600">
            Cantidad utilizada: {formatBigInt(node.amount)}
          </p>
        ) : null}
        {node.detail.metadata ? (
          <div className="mt-3 text-xs text-slate-600">
            <p className="font-semibold">Datos principales</p>
            <div className="mt-1 grid gap-1 md:grid-cols-2">
              {Object.entries(node.detail.metadata)
                .slice(0, 4)
                .map(([key, value]) => (
                  <div key={key} className="rounded-xl bg-surface-2 px-3 py-2">
                    <span className="block text-[10px] uppercase tracking-[0.3em] text-slate-400">{formatKey(key)}</span>
                    <span className="text-xs text-slate-700">{formatValue(value)}</span>
                  </div>
                ))}
            </div>
          </div>
        ) : null}
      </div>
      {node.children.length ? (
        <ul className="mt-3 space-y-3">
          {node.children.map(child => (
            <TraceTree key={`${node.detail.id}-${child.detail.id}`} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function TokensPage() {
  const { t } = useI18n();
  const { account, mustConnect } = useWeb3();
  const { isApproved, loading: roleLoading, statusLabel } = useRole();

  const [tokens, setTokens] = useState<TokenDetail[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [trace, setTrace] = useState<TraceNode | null>(null);
  const [loading, setLoading] = useState(false);

  const cacheRef = useRef(new Map<number, TokenDetail>());

  const { theme } = useRoleTheme();

  const fetchDetail = useCallback(
    async (id: number, options: { includeBalance?: boolean } = {}): Promise<TokenDetail> => {
      const cached = cacheRef.current.get(id);
      if (cached && (!options.includeBalance || typeof cached.balance === "bigint")) {
        return cached;
      }
      const view = await getTokenView(id);
      const components = await getTokenInputs(id);
      const features = String(view[5]);
      let balance = cached?.balance ?? 0n;
      if (options.includeBalance && account) {
        try {
          const raw = await getTokenBalance(id, account);
          balance = BigInt(raw);
        } catch (err) {
          console.error(err);
        }
      }
      const detail: TokenDetail = {
        id: Number(view[0]),
        creator: String(view[1]),
        name: String(view[2]),
        description: String(view[3] ?? ""),
        totalSupply: BigInt(view[4]),
        features,
        parentId: Number(view[6]),
        createdAt: Number(view[7]),
        availableSupply: BigInt(view[8] ?? 0n),
        balance,
        metadata: parseMetadata(features),
        inputs: components,
      };
      cacheRef.current.set(id, detail);
      return detail;
    },
    [account]
  );

  const buildTrace = useCallback(
    async (rootId: number): Promise<TraceNode> => {
      const visited = new Set<number>();
      const walk = async (id: number, amount?: bigint): Promise<TraceNode> => {
        const detail = await fetchDetail(id);
        if (visited.has(id)) {
          return { detail, amount, children: [] };
        }
        visited.add(id);
        const children: TraceNode[] = [];
        for (const input of detail.inputs) {
          children.push(await walk(input.tokenId, input.amount));
        }
        return { detail, amount, children };
      };
      return walk(rootId);
    },
    [fetchDetail]
  );

  const refresh = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!account || mustConnect) {
        setTokens([]);
        setSelectedId(null);
        setTrace(null);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const ids = await getUserTokens(account);
        const owned: TokenDetail[] = [];
        for (const rawId of ids) {
          const id = Number(rawId);
          try {
            const detail = await fetchDetail(id, { includeBalance: true });
            cacheRef.current.set(id, detail);
            if (detail.balance > 0n) owned.push(detail);
          } catch (err) {
            console.error(err);
          }
        }
        owned.sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);
        setTokens(owned);
        if (owned.length > 0) {
          setSelectedId(prev => (prev && owned.some(token => token.id === prev) ? prev : owned[0].id));
        } else {
          setSelectedId(null);
          setTrace(null);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [account, mustConnect, fetchDetail]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useBlockWatcher(() => refresh({ silent: true }), [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setTrace(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const tree = await buildTrace(selectedId);
        if (!cancelled) setTrace(tree);
      } catch (err) {
        console.error(err);
        if (!cancelled) setTrace(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, buildTrace]);

  if (mustConnect) {
    return (
      <div className="rounded-3xl border border-surface bg-surface-1 p-6 text-sm text-slate-600 shadow-inner">
        {t("transfers.connectPrompt")}
      </div>
    );
  }

  if (!roleLoading && !isApproved) {
    return (
      <div className="rounded-3xl border border-amber-300/60 bg-amber-50/80 p-6 text-sm text-amber-900 shadow-sm">
        <p className="font-semibold">{t("tokens.create.notApprovedTitle")}</p>
        <p>{t("tokens.create.notApprovedBody", { status: statusLabel ?? t("common.status.none") })}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 rounded-[28px] border ${theme.accentBorder} ${theme.background} p-6 shadow-xl shadow-black/5`}>
      <header className={`rounded-3xl bg-gradient-to-r ${theme.gradient} px-6 py-5 text-white shadow-lg`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] opacity-80">{theme.label}</p>
            <h1 className="text-2xl font-semibold">{theme.icon} Tokens disponibles</h1>
            <p className="mt-2 max-w-3xl text-sm opacity-90">{theme.intro}</p>
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            disabled={loading}
            className="rounded-full border border-white/60 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
          >
            {loading ? t("tokens.refreshing") : t("tokens.refresh")}
          </button>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <aside className={`space-y-4 rounded-3xl border ${theme.accentBorder} bg-surface-1 p-5 shadow-inner`}>
          <h2 className="text-sm font-semibold text-slate-700">Mis tokens</h2>
          {tokens.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-surface bg-surface-2 p-4 text-sm text-slate-500">{theme.empty}</p>
          ) : (
            <div className="grid gap-3">
              {tokens.map(token => {
                const isActive = selectedId === token.id;
                return (
                  <button
                    key={token.id}
                    type="button"
                    onClick={() => setSelectedId(token.id)}
                    className={`rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
                      isActive
                        ? `border-transparent bg-gradient-to-r ${theme.gradient} text-white`
                        : `${theme.accentBorder} bg-surface-2 text-slate-700 hover:border-accent`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">#{token.id} · {token.name}</p>
                        <p className={`text-xs ${isActive ? "text-white/80" : "text-slate-500"}`}>
                          {token.description || "Sin descripción"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">Saldo: {formatBigInt(token.balance)}</p>
                        <p className={`text-xs ${isActive ? "text-white/80" : "text-slate-500"}`}>
                          Disponible global: {formatBigInt(token.availableSupply)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className={`space-y-5 rounded-3xl border ${theme.accentBorder} bg-surface-1 p-6 shadow-inner`}>
          {selectedId && trace ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">#{trace.detail.id} · {trace.detail.name}</h2>
                  <p className="text-sm text-slate-500">{trace.detail.description || "Sin descripción"}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>Saldo actual: {formatBigInt(trace.detail.balance)}</p>
                  <p>Disponible global: {formatBigInt(trace.detail.availableSupply)}</p>
                  <p>Creado: {trace.detail.createdAt ? new Date(trace.detail.createdAt * 1000).toLocaleString("en-US", { timeZone: "UTC" }) : "-"}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700">Características</h3>
                <MetadataPanel metadata={trace.detail.metadata} />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700">Cadena de trazabilidad</h3>
                <p className="text-xs text-slate-500">
                  Cada nivel muestra los tokens origen y las cantidades utilizadas para crear el activo seleccionado.
                </p>
                <ul className="mt-3 space-y-3">
                  <TraceTree node={trace} />
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Seleccioná un token de la lista para ver sus detalles.</p>
          )}
        </section>
      </div>
    </div>
  );
}
