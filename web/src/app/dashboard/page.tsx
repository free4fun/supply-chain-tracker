// web/src/app/dashboard/page.tsx
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useWeb3 } from "@/contexts/Web3Context";
import { useRole } from "@/contexts/RoleContext";
import { useBlockWatcher } from "@/hooks/useBlockWatcher";
import { getUserTokens, getTokenBalance } from "@/lib/sc";

const ROLE_PANELS = {
  Producer: {
    title: "Productor",
    next: "Factory",
    tips: [
      "Tokenizá lotes de materia prima desde Crear activos.",
      "Verificá tus balances antes de despachar.",
      "Generá transferencias únicamente hacia fábricas aprobadas.",
    ],
    actions: [
      { href: "/tokens/create", label: "Crear nuevo lote" },
      { href: "/transfers", label: "Transferir a fábrica" },
    ],
  },
  Factory: {
    title: "Fábrica",
    next: "Retailer",
    tips: [
      "Aceptá recepciones pendientes para liberar stock.",
      "Creá productos derivados usando el campo Parent ID.",
      "Despachá únicamente a retailers habilitados.",
    ],
    actions: [
      { href: "/tokens/create", label: "Crear derivado" },
      { href: "/transfers", label: "Enviar a retailer" },
    ],
  },
  Retailer: {
    title: "Retailer",
    next: "Consumer",
    tips: [
      "Aceptá lotes entrantes desde la bandeja de Transfers.",
      "Controlá inventario disponible en el Dashboard.",
      "Programá entregas finales a consumidores registrados.",
    ],
    actions: [
      { href: "/transfers", label: "Transferir a consumidor" },
    ],
  },
  Consumer: {
    title: "Consumer",
    tips: [
      "Aceptá transferencias pendientes para cerrar la trazabilidad.",
      "Revisá el historial del lote y sus metadatos.",
      "Comparte comprobantes de origen con tus clientes finales.",
    ],
    actions: [
      { href: "/dashboard", label: "Ver trazabilidad" },
    ],
  },
} as const;

const ADMIN_PANEL = {
  title: "Administrador",
  tips: [
    "Supervisá solicitudes recientes en Admin · Users.",
    "Actualizá estados de usuarios según la documentación recibida.",
    "Verificá actividades inusuales y cambios de rol.",
  ],
  actions: [{ href: "/admin/users", label: "Ir a gestión de usuarios" }],
} as const;

export default function Dashboard() {
  const { account, mustConnect, error } = useWeb3();
  const { activeRole, isApproved, loading: roleLoading, statusLabel, isAdmin } = useRole();

  const [tokens, setTokens] = useState<number[]>([]);
  const [balances, setBalances] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

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
          nums.map(async id => {
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

  const panel = useMemo(() => {
    if (activeRole && (ROLE_PANELS as Record<string, unknown>)[activeRole]) {
      return ROLE_PANELS[activeRole as keyof typeof ROLE_PANELS];
    }
    if (isAdmin) return ADMIN_PANEL;
    return undefined;
  }, [activeRole, isAdmin]);

  if (mustConnect) {
    return (
      <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70 dark:text-slate-300">
        Conectá tu wallet para sincronizar balances y recomendaciones por rol.
      </div>
    );
  }

  if (error) return <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>;

  if (!roleLoading && !isApproved && !isAdmin) {
    return (
      <div className="space-y-3 rounded-3xl border border-amber-300/60 bg-amber-50/70 p-6 text-sm text-amber-900 shadow-sm dark:border-amber-300/40 dark:bg-amber-500/10 dark:text-amber-100">
        <p className="font-semibold">Tu cuenta aún no está aprobada.</p>
        <p>
          Estado actual: <span className="font-medium">{statusLabel ?? "Sin registro"}</span>. Visitá la sección
          <Link href="/profile" className="ml-1 underline underline-offset-4">Perfil</Link> para solicitar o revisar tu rol.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Inventario on-chain</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Balances por token asignados a tu cuenta actual.</p>
            </div>
            <button
              onClick={() => refreshBalances()}
              disabled={loading}
              className="rounded-full border border-slate-300/70 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
            >
              {loading ? "Actualizando…" : "Actualizar"}
            </button>
          </div>

          <div className="grid gap-3">
            {tokens.length === 0 && !loading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Sin tokens registrados en esta cuenta.</p>
            ) : null}
            {tokens.map(id => (
              <div
                key={id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Token #{id}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Balance disponible</p>
                </div>
                <span className="text-lg font-semibold text-indigo-600 dark:text-indigo-300">{balances[id] ?? "…"}</span>
              </div>
            ))}
          </div>
        </section>

        {panel ? (
          <aside className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/80">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{panel.title}</h3>
              {panel.next ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Próximo eslabón permitido: {panel.next}</p>
              ) : null}
            </div>
            <ul className="grid gap-2 text-sm text-slate-600 dark:text-slate-300">
              {panel.tips.map(tip => (
                <li key={tip} className="rounded-xl border border-slate-200/60 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
                  {tip}
                </li>
              ))}
            </ul>
            {panel.actions?.length ? (
              <div className="flex flex-wrap gap-2">
                {panel.actions.map(action => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="rounded-full bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
