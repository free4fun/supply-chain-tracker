"use client";
import { useEffect, useMemo, useState } from "react";
import { requestUserRole } from "@/lib/sc";
import { useToast } from "@/contexts/ToastContext";
import { z } from "zod";
import { useWeb3 } from "@/contexts/Web3Context";
import { useRole } from "@/contexts/RoleContext";

const ROLES = ["Producer","Factory","Retailer","Consumer"] as const;
const schema = z.object({ role: z.enum(ROLES) });

export default function ProfilePage() {
  const { activeRole, statusLabel, isRegistered, isApproved, lastRequestedRole, lastRequestedAt, refresh, loading: roleLoading, isAdmin } = useRole();
  const initialRole = useMemo<(typeof ROLES)[number]>(() => {
    const candidate = (activeRole || lastRequestedRole) as (typeof ROLES)[number] | undefined;
    return candidate && ROLES.includes(candidate) ? candidate : "Producer";
  }, [activeRole, lastRequestedRole]);
  const [role, setRole] = useState<(typeof ROLES)[number]>(initialRole);
  const [pending, setPending] = useState(false);

  const { push } = useToast();
  // Expecting these from Web3Context; if not present, only `account` is used.
  const { account, mustConnect, reconnect, switchAcc } = useWeb3() as any;

  useEffect(() => {
    const candidate = (activeRole || lastRequestedRole) as (typeof ROLES)[number] | undefined;
    if (candidate && ROLES.includes(candidate)) {
      setRole(candidate);
    }
  }, [activeRole, lastRequestedRole]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ role });
    if (!parsed.success) { push("error","Invalid role"); return; }
    if (!account) { push("error","Connect wallet first"); return; }
    try {
      setPending(true);
      await requestUserRole(parsed.data.role);
      push("success","Role request sent");
      await refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      push("error", message);
    } finally {
      setPending(false);
    }
  }

  // Wallet not connected or user rejected: guide to connect/switch
  if (mustConnect) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Profile</h1>
        <p className="text-sm">You must connect your wallet.</p>
        <div className="flex gap-2">
          <button onClick={reconnect} className="px-3 py-1 rounded bg-black text-white">Connect wallet</button>
          <button onClick={switchAcc} className="px-3 py-1 rounded border">Switch account</button>
        </div>
      </div>
    );
  }

  const lastRequestText = lastRequestedAt ? new Date(lastRequestedAt * 1000).toLocaleString() : undefined;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Profile</h1>

      <section className="space-y-3 rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/80">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Estado de tu organización</h2>
        <div className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-400">Cuenta conectada</span>
            <span className="break-all font-semibold text-slate-800 dark:text-slate-100">{account}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-400">Rol actual</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {roleLoading ? "Sincronizando…" : activeRole || (isAdmin ? "Admin" : isRegistered ? "No asignado" : "Sin registro")}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-400">Estado</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-300">{roleLoading ? "Actualizando" : statusLabel ?? "Sin registro"}</span>
          </div>
          {lastRequestedRole ? (
            <div className="flex flex-col gap-0.5 rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3 text-xs dark:border-slate-700 dark:bg-slate-900/70">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Última solicitud enviada</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{lastRequestedRole}</span>
              {lastRequestText ? <span className="text-slate-500 dark:text-slate-400">{lastRequestText}</span> : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/80">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Solicitar o actualizar rol</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Seleccioná el rol que representa tu función dentro de la cadena de suministro. El administrador recibirá la solicitud y
          podrá aprobarla o rechazarla según corresponda.
        </p>
        <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Rol solicitado
            <select
              className="mt-1 rounded-xl border border-slate-300/70 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              value={role}
              onChange={e => setRole(e.target.value as (typeof ROLES)[number])}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={!account || pending}
            className="rounded-full bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:brightness-110 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            {pending ? "Enviando…" : "Solicitar rol"}
          </button>
        </form>
        {!isApproved && !roleLoading && !isAdmin ? (
          <p className="text-xs text-amber-600 dark:text-amber-300">
            Tu solicitud quedará pendiente hasta que el administrador la revise. Podés volver más tarde para ver el estado
            actualizado.
          </p>
        ) : null}
      </section>
    </div>
  );
}
