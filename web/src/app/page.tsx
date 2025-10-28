// web/src/app/page.tsx
"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useWeb3 } from "@/contexts/Web3Context";
import { useRole } from "@/contexts/RoleContext";

const ROLE_GUIDES = {
  Producer: {
    description: "Tokenizá materias primas y asegurá su entrega a plantas verificadas.",
    steps: [
      "Solicitá el rol desde Perfil y esperá la aprobación del administrador.",
      "Creá nuevos lotes en Crear activos para representar tu producción.",
      "Generá transferencias únicamente hacia fábricas aprobadas desde Transfers.",
    ],
    actions: [
      { href: "/tokens/create", label: "Crear materia prima" },
      { href: "/transfers", label: "Transferir a fábrica" },
    ],
  },
  Factory: {
    description: "Convertí materias primas en productos listos para el retail.",
    steps: [
      "Aceptá transferencias entrantes y verificá los lotes en Dashboard.",
      "Tokenizá productos derivados indicando el ID padre correspondiente.",
      "Prepará envíos hacia retailers autorizados manteniendo la trazabilidad.",
    ],
    actions: [
      { href: "/tokens/create", label: "Crear derivado" },
      { href: "/transfers", label: "Enviar a retailer" },
    ],
  },
  Retailer: {
    description: "Gestioná inventario disponible para la última milla.",
    steps: [
      "Controlá recepciones pendientes y acepta los lotes que lleguen de la fábrica.",
      "Monitoreá existencias y lotes en Dashboard para detectar faltantes.",
      "Generá transferencias finales hacia consumidores registrados.",
    ],
    actions: [
      { href: "/transfers", label: "Transferir a consumidor" },
      { href: "/dashboard", label: "Ver inventario" },
    ],
  },
  Consumer: {
    description: "Consultá la procedencia completa de los bienes recibidos.",
    steps: [
      "Aceptá transferencias pendientes para consolidar la recepción.",
      "Analizá la trazabilidad y los metadatos del lote en Dashboard.",
      "Compartí comprobantes de origen con tus clientes finales si lo necesitás.",
    ],
    actions: [
      { href: "/dashboard", label: "Revisar trazabilidad" },
    ],
  },
  Admin: {
    description: "Supervisá el sistema y aprobá a los nuevos participantes.",
    steps: [
      "Revisá solicitudes de rol desde Admin · Users y verificá su legitimidad.",
      "Actualizá estados (Pending, Approved, Rejected) según la documentación recibida.",
      "Monitorizá transacciones críticas y cambios de rol para mantener la red saludable.",
    ],
    actions: [
      { href: "/admin/users", label: "Gestionar usuarios" },
    ],
  },
} as const;

type RoleKey = keyof typeof ROLE_GUIDES;

function RoleWorkflowSection({
  initialRole,
  derivedRole,
  roleOptions,
  isApproved,
  roleLoading,
  statusLabel,
  lastRequestedRole,
  lastRequestedAt,
}: {
  initialRole: RoleKey;
  derivedRole?: RoleKey;
  roleOptions: RoleKey[];
  isApproved: boolean;
  roleLoading: boolean;
  statusLabel?: string;
  lastRequestedRole?: RoleKey;
  lastRequestedAt?: number;
}) {
  const [selectedRole, setSelectedRole] = useState<RoleKey>(initialRole);
  const guide = ROLE_GUIDES[selectedRole];
  const isCurrentRole = derivedRole ? selectedRole === derivedRole : false;
  const lastRequestText = lastRequestedAt ? new Date(lastRequestedAt * 1000).toLocaleString() : undefined;

  return (
    <section className="grid gap-6 rounded-[24px] border border-slate-200/60 bg-white/80 p-8 shadow-[0_14px_45px_-32px_rgba(15,23,42,0.65)] backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/80">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Flujo de trabajo por rol</h2>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Explorá las responsabilidades clave y accesos habilitados para cada actor de la cadena. Seleccioná un rol para ver
            los pasos sugeridos y accesos directos relacionados.
          </p>
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          Rol a revisar
          <select
            className="rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            value={selectedRole}
            onChange={event => setSelectedRole(event.target.value as RoleKey)}
          >
            {roleOptions.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-6 rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/80">
        <div className="flex flex-col gap-2">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-200/60 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-600 dark:border-indigo-500/40 dark:text-indigo-300">
            {selectedRole}
            {isCurrentRole && (
              <span className="rounded-full bg-indigo-600/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-100 dark:text-indigo-200">
                Tu rol
              </span>
            )}
          </span>
          <p className="text-sm text-slate-600 dark:text-slate-300">{guide.description}</p>
          {lastRequestedRole && !derivedRole ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Última solicitud: {lastRequestedRole}
              {lastRequestText ? ` · ${lastRequestText}` : ""}
            </p>
          ) : null}
        </div>

        <ol className="grid gap-3 text-sm text-slate-700 dark:text-slate-200 md:grid-cols-3">
          {guide.steps.map((step, index) => (
            <li
              key={index}
              className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 font-medium shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70"
            >
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        {guide.actions?.length ? (
          <div className="flex flex-wrap items-center gap-3">
            {guide.actions.map(action => (
              isCurrentRole ? (
                <Link
                  key={action.href}
                  href={action.href}
                  className="rounded-full bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  {action.label}
                </Link>
              ) : (
                <span
                  key={action.href}
                  className="rounded-full border border-slate-200/80 px-4 py-2 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400"
                >
                  {action.label}
                </span>
              )
            ))}
            {!isCurrentRole && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Conectate con una cuenta del rol seleccionado para habilitar estos accesos.
              </span>
            )}
          </div>
        ) : null}

        {!isApproved && !roleLoading && selectedRole !== "Admin" && (
          <p className="text-xs text-amber-600 dark:text-amber-300">
            Estado actual: {statusLabel ?? "Sin registro"}. Podés solicitar o revisar tu rol desde la sección Perfil.
          </p>
        )}
      </div>
    </section>
  );
}

export default function Page() {
  const { account, chainId, ready, mustConnect, error, reconnect, switchAcc } = useWeb3();
  const { activeRole, statusLabel, isApproved, loading: roleLoading, lastRequestedRole, lastRequestedAt, isAdmin } = useRole();

  const roleOptions = useMemo(() => Object.keys(ROLE_GUIDES) as RoleKey[], []);

  const derivedRole = useMemo<RoleKey | undefined>(() => {
    if (activeRole && (ROLE_GUIDES as Record<string, unknown>)[activeRole]) {
      return activeRole as RoleKey;
    }
    if (!activeRole && isAdmin) return "Admin";
    return undefined;
  }, [activeRole, isAdmin]);

  const validLastRequestedRole = useMemo<RoleKey | undefined>(() => {
    if (lastRequestedRole && (ROLE_GUIDES as Record<string, unknown>)[lastRequestedRole]) {
      return lastRequestedRole as RoleKey;
    }
    return undefined;
  }, [lastRequestedRole]);

  const initialWorkflowRole = derivedRole ?? validLastRequestedRole ?? "Producer";
  const workflowKey = `${account ?? "guest"}-${derivedRole ?? "none"}-${validLastRequestedRole ?? "none"}`;

  const roleLabel = roleLoading
    ? "Sincronizando…"
    : isAdmin
      ? "Admin"
      : activeRole
        ? activeRole
        : lastRequestedRole
          ? `${lastRequestedRole} (solicitado)`
          : "Sin rol registrado";

  const roleStatusText = roleLoading
    ? ""
    : isAdmin
      ? "Control total del sistema"
      : statusLabel || "Solicitá acceso desde tu perfil";

  return (
    <main className="relative isolate mx-auto flex w-full max-w-6xl flex-col gap-10 p-6 md:p-10">
      <div className="absolute inset-0 -z-10 overflow-hidden rounded-[32px] border border-white/20 bg-white/70 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70" />

      <section className="grid gap-10 rounded-[28px] border border-slate-200/60 bg-white/80 p-8 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.5)] backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/80 md:grid-cols-[1.2fr,1fr] md:p-12">
        <div className="space-y-6 text-slate-900 dark:text-slate-100">
          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500/20 to-sky-500/20 px-4 py-1 text-sm font-medium text-indigo-600 dark:text-indigo-300">
            Next-gen visibility for your supply chain
          </span>
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl dark:text-white">
              Track every asset with confidence and real-time clarity
            </h1>
            <p className="max-w-xl text-base text-slate-600 md:text-lg dark:text-slate-300">
              Connect your wallet to orchestrate transfers, monitor tokenized goods and keep stakeholders aligned. Our dashboard turns complex blockchain data into actionable intelligence.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={reconnect}
              className="rounded-full bg-gradient-to-r from-indigo-600 to-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              disabled={!ready}
            >
              {account ? "Reconnect wallet" : "Connect wallet"}
            </button>
            <button
              onClick={switchAcc}
              className="rounded-full border border-slate-300/60 px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-indigo-400 hover:text-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-400"
              disabled={!ready}
            >
              Switch account
            </button>
            {mustConnect && (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/60 bg-amber-100/60 px-4 py-2 text-xs font-medium text-amber-700 dark:border-amber-300/50 dark:bg-amber-500/10 dark:text-amber-200">
                Wallet connection required
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-2xl">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-300">Connection status</p>
            <div className="mt-5 space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-400">Wallet</p>
                <p className="truncate text-lg font-semibold">
                  {!ready ? "Initializing…" : account ? account : "No wallet connected"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400">Network</p>
                <p className="text-lg font-semibold">{chainId ? `Chain ${chainId}` : "Detecting network…"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400">Rol</p>
                <p className="text-lg font-semibold">{roleLabel}</p>
                {roleStatusText && (
                  <p className="text-xs text-slate-400">{roleStatusText}</p>
                )}
              </div>
              {error && (
                <div className="rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-100">
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 rounded-3xl border border-slate-200/60 bg-white/70 p-6 text-slate-900 shadow-inner backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-900/80 dark:text-slate-100">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Get started in three steps</p>
            <ol className="grid gap-3 text-sm md:text-base">
              <li className="rounded-2xl bg-slate-50/80 px-4 py-3 font-medium text-slate-700 dark:bg-white/5 dark:text-slate-200">
                1. Connect a supported wallet to authenticate your organization.
              </li>
              <li className="rounded-2xl bg-slate-50/80 px-4 py-3 font-medium text-slate-700 dark:bg-white/5 dark:text-slate-200">
                2. Configure tracked assets and assign custodians within the dashboard.
              </li>
              <li className="rounded-2xl bg-slate-50/80 px-4 py-3 font-medium text-slate-700 dark:bg-white/5 dark:text-slate-200">
                3. Monitor transfers in real time and share insights with partners.
              </li>
            </ol>
          </div>
        </div>
      </section>

      <RoleWorkflowSection
        key={workflowKey}
        initialRole={initialWorkflowRole}
        derivedRole={derivedRole}
        roleOptions={roleOptions}
        isApproved={isApproved}
        roleLoading={roleLoading}
        statusLabel={statusLabel}
        lastRequestedRole={validLastRequestedRole}
        lastRequestedAt={lastRequestedAt}
      />

      <section className="grid gap-4 rounded-[24px] border border-slate-200/60 bg-white/80 p-8 shadow-[0_12px_40px_-30px_rgba(15,23,42,0.7)] backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/80">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Why teams choose Supply Chain Tracker</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[{
            title: "Unified audit trail",
            description: "Every transaction is immutably recorded on-chain, giving auditors and partners trusted, verifiable data.",
          },
          {
            title: "Operational intelligence",
            description: "Visual KPIs and alerts surface emerging risks before they disrupt fulfillment schedules.",
          },
          {
            title: "Stakeholder alignment",
            description: "Secure sharing keeps suppliers and customers on the same page without exposing sensitive details.",
          }].map((feature) => (
            <article
              key={feature.title}
              className="group rounded-3xl border border-slate-200/60 bg-white/80 p-6 transition hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl dark:border-slate-800/60 dark:bg-slate-900/80 dark:hover:border-indigo-400/70"
            >
              <h3 className="text-lg font-semibold text-slate-900 transition group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
