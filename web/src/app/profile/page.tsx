"use client";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { requestUserRole, cancelRoleRequest, registerAndRequestRole, updateUserProfile } from "@/lib/sc";
import { useToast } from "@/contexts/ToastContext";
import { useWeb3 } from "@/contexts/Web3Context";
import { useRole } from "@/contexts/RoleContext";
import { useI18n } from "@/contexts/I18nContext";
import { useRoleTheme } from "@/hooks/useRoleTheme";
import { getErrorMessage } from "@/lib/errors";
import { handleBlockOutOfRange } from "@/lib/blockOutOfRange";

const ROLES = ["Producer", "Factory", "Retailer", "Consumer"] as const;
const schema = z.object({ role: z.enum(ROLES) });

enum ToastKind {
  Success = "success",
  Error = "error",
}

export default function ProfilePage() {
  const { t } = useI18n();
  const { theme } = useRoleTheme();
  const { activeRole, statusLabel, isRegistered, isApproved, lastRequestedRole, lastRequestedAt, pendingRole, company: companySnap, firstName: firstNameSnap, lastName: lastNameSnap, refresh, loading: roleLoading, isAdmin } = useRole();
  const initialRole = useMemo<(typeof ROLES)[number]>(() => {
    const candidate = (activeRole || lastRequestedRole) as (typeof ROLES)[number] | undefined;
    return candidate && ROLES.includes(candidate) ? candidate : "Producer";
  }, [activeRole, lastRequestedRole]);
  const [role, setRole] = useState<(typeof ROLES)[number]>(initialRole);
  const [pending, setPending] = useState(false);
  const [company, setCompany] = useState<string>(companySnap || "");
  const [firstName, setFirstName] = useState<string>(firstNameSnap || "");
  const [lastName, setLastName] = useState<string>(lastNameSnap || "");
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [lastTxAction, setLastTxAction] = useState<string | null>(null);

  const { push } = useToast();
  // Expecting these from Web3Context; if not present, only `account` is used.
  const { account, mustConnect, reconnect, switchAcc } = useWeb3() as any;

  useEffect(() => {
    const candidate = (activeRole || lastRequestedRole) as (typeof ROLES)[number] | undefined;
    if (candidate && ROLES.includes(candidate)) {
      setRole(candidate);
    }
    setCompany(companySnap || "");
    setFirstName(firstNameSnap || "");
    setLastName(lastNameSnap || "");
  }, [activeRole, lastRequestedRole, companySnap, firstNameSnap, lastNameSnap]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse({ role });
    if (!parsed.success) {
      push(ToastKind.Error, t("profile.toast.invalidRole"));
      return;
    }
    if (!account) {
      push(ToastKind.Error, t("profile.toast.connectWallet"));
      return;
    }
    if (isApproved && activeRole && parsed.data.role === activeRole) {
      push(ToastKind.Error, t("profile.request.sameAsCurrent"));
      return;
    }
    try {
      setPending(true);
      // Try-catch around the actual contract call to detect if user needs registration
      try {
        if (!isRegistered) {
          // First-time registration requires profile
          if (!company || !firstName || !lastName) {
            push(ToastKind.Error, t("profile.request.profileRequired"));
            setPending(false);
            return;
          }
          const result = await registerAndRequestRole(company, firstName, lastName, parsed.data.role);
          setLastTxHash(result.txHash);
          setLastTxAction(`Registro completado y rol ${parsed.data.role} solicitado`);
        } else {
          const result = await requestUserRole(parsed.data.role);
          setLastTxHash(result.txHash);
          setLastTxAction(`Rol ${parsed.data.role} solicitado`);
        }
      } catch (innerErr: unknown) {
        // If we get NoUser error, it means we need to use registerAndRequestRole
        const innerMsg = innerErr instanceof Error ? innerErr.message : "";
        if (innerMsg.includes("NoUser") || innerMsg.includes("User not found")) {
          if (!company || !firstName || !lastName) {
            push(ToastKind.Error, t("profile.request.profileRequired"));
            setPending(false);
            return;
          }
          const result = await registerAndRequestRole(company, firstName, lastName, parsed.data.role);
          setLastTxHash(result.txHash);
          setLastTxAction(`Registro completado y rol ${parsed.data.role} solicitado`);
        } else {
          throw innerErr;
        }
      }
      push(ToastKind.Success, t("profile.toast.success"));
      await refresh();
    } catch (err: unknown) {
      if (!handleBlockOutOfRange(err)) {
        let message = getErrorMessage(err, t("profile.toast.failure"));
        if (message) {
          if (message.includes("CALL_EXCEPTION") || message.includes("execution reverted")) {
            message = t("profile.toast.contractOutdated");
          }
          push(ToastKind.Error, message);
        }
      }
    } finally {
      setPending(false);
    }
  }

  async function saveProfile() {
    if (!account) {
      push(ToastKind.Error, t("profile.toast.connectWallet"));
      return;
    }
    if (!isRegistered) {
      push(ToastKind.Error, t("profile.profile.notRegistered"));
      return;
    }
    if (!company || !firstName || !lastName) {
      push(ToastKind.Error, t("profile.request.profileRequired"));
      return;
    }
    try {
      setPending(true);
      const result = await updateUserProfile(company, firstName, lastName);
      setLastTxHash(result.txHash);
      setLastTxAction("Perfil actualizado");
      push(ToastKind.Success, t("profile.profile.saved"));
      await refresh();
    } catch (err: unknown) {
      if (!handleBlockOutOfRange(err)) {
        let message = getErrorMessage(err, t("profile.toast.failure"));
        if (message) {
          if (message.includes("CALL_EXCEPTION") || message.includes("execution reverted")) {
            message = t("profile.toast.contractOutdated");
          }
          push(ToastKind.Error, message);
        }
      }
    } finally {
      setPending(false);
    }
  }

  async function cancelRequest() {
    if (!account) {
      push(ToastKind.Error, t("profile.toast.connectWallet"));
      return;
    }
    try {
      setPending(true);
      const result = await cancelRoleRequest();
      setLastTxHash(result.txHash);
      setLastTxAction("Solicitud de rol cancelada");
      push(ToastKind.Success, t("profile.toast.cancelSuccess"));
      await refresh();
    } catch (err: unknown) {
      if (!handleBlockOutOfRange(err)) {
        const message = getErrorMessage(err, t("profile.toast.failure"));
        if (message) push(ToastKind.Error, message);
      }
    } finally {
      setPending(false);
    }
  }

  if (mustConnect) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">{t("profile.title")}</h1>
        <p className="text-sm">{t("profile.connect.description")}</p>
        <div className="flex gap-2">
          <button onClick={reconnect} className="rounded bg-black px-3 py-1 text-sm font-semibold text-white">
            {t("profile.connect.primary")}
          </button>
          <button onClick={switchAcc} className="rounded border border-surface px-3 py-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {t("profile.connect.secondary")}
          </button>
        </div>
      </div>
    );
  }

  const lastRequestText = lastRequestedAt ? new Date(lastRequestedAt * 1000).toLocaleString("en-US", { timeZone: "UTC" }) : undefined;
  const translatedRole = activeRole ? t(`roles.${activeRole}`) : isAdmin ? t("roles.Admin") : isRegistered ? t("profile.status.unassigned") : t("common.status.none");
  const translatedStatus = statusLabel ? translateStatus(statusLabel, t) : t("common.status.none");
  const translatedLastRequestedRole = lastRequestedRole ? t(`roles.${lastRequestedRole}`) : undefined;
  const showCancel = !!pendingRole && (!isApproved || pendingRole !== activeRole);

  return (
<div className={`space-y-6 rounded-[28px] border ${theme.accentBorder} ${theme.background} p-6 shadow-xl shadow-black/5`}>
      <header className={`rounded-3xl bg-gradient-to-r ${theme.gradient} px-6 py-5 text-white shadow-lg`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] opacity-80">{theme.label}</p>
            <h1 className="text-2xl font-semibold">{theme.icon} Perfil y configuración</h1>
            <p className="mt-2 max-w-4xl text-sm opacity-90">Administrá tu información de perfil y solicitá cambios de rol para participar en la cadena.</p>
          </div>
        </div>
      </header>

      {lastTxHash && lastTxAction && (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50/80 dark:bg-emerald-900/20 dark:border-emerald-700 p-5 shadow-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div className="flex-1 space-y-2">
              <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                {lastTxAction}
              </h3>
              <div className="space-y-1">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Hash de transacción:</p>
                <code className="block rounded-lg bg-emerald-100 dark:bg-emerald-900/40 px-3 py-2 text-xs font-mono text-emerald-900 dark:text-emerald-100 break-all">
                  {lastTxHash}
                </code>
              </div>
              <button
                onClick={() => {
                  setLastTxHash(null);
                  setLastTxAction(null);
                }}
                className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 underline"
              >
                Cerrar mensaje
              </button>
            </div>
          </div>
        </section>
      )}

  <section className={`space-y-3 rounded-3xl border bg-white dark:bg-slate-900 p-6 shadow-inner ${theme.containerBorder}`}>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 cursor-default">{t("profile.status.heading")}</h2>
        <div className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-400">{t("profile.status.connectedAccount")}</span>
            <span className="break-all font-semibold text-slate-800 dark:text-slate-100">{account}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-400">{t("profile.status.currentRole")}</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {roleLoading ? t("common.loading.sync") : translatedRole}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-400">{t("profile.status.state")}</span>
            <span className="font-semibold text-accent">{roleLoading ? t("profile.status.updating") : translatedStatus}</span>
          </div>
          {lastRequestedRole ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-surface bg-surface-2 px-4 py-3 text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-300">{t("profile.status.lastRequest.heading")}</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{translatedLastRequestedRole ?? lastRequestedRole}</span>
              {lastRequestText ? <span className="text-slate-500 dark:text-slate-400">{t("profile.status.lastRequest.time", { time: lastRequestText })}</span> : null}
              {showCancel ? (
                <div>
                  <button className={`px-3 py-1 rounded-full border text-sm font-semibold transition ${theme.btnSecondary} ${theme.btnSecondaryHover}`} onClick={cancelRequest} disabled={pending}>{t("admin.users.actions.cancel")}</button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

  <section className={`space-y-3 rounded-3xl border bg-white dark:bg-slate-900 p-6 shadow-inner ${theme.containerBorder}`}>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t("profile.profile.heading")}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {t("profile.profile.company")}
            <input
              className={`mt-1 w-full rounded-xl border bg-surface-2 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 shadow-sm transition hover:border-accent ${theme.inputBorder} ${theme.inputFocusBorder} focus-visible:outline-none`}
              value={company}
              onChange={e=>setCompany(e.target.value)}
              placeholder={t("profile.profile.companyPlaceholder")}
            />
          </label>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {t("profile.profile.firstName")}
            <input
              className={`mt-1 w-full rounded-xl border bg-surface-2 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 shadow-sm transition hover:border-accent ${theme.inputBorder} ${theme.inputFocusBorder} focus-visible:outline-none`}
              value={firstName}
              onChange={e=>setFirstName(e.target.value)}
              placeholder={t("profile.profile.firstNamePlaceholder")}
            />
          </label>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {t("profile.profile.lastName")}
            <input
              className={`mt-1 w-full rounded-xl border bg-surface-2 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 shadow-sm transition hover:border-accent ${theme.inputBorder} ${theme.inputFocusBorder} focus-visible:outline-none`}
              value={lastName}
              onChange={e=>setLastName(e.target.value)}
              placeholder={t("profile.profile.lastNamePlaceholder")}
            />
          </label>
        </div>
        <div>
          <button
            onClick={saveProfile}
            disabled={!account || pending}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${theme.btnSecondary} ${theme.btnSecondaryHover}`}
          >
            {pending ? t("profile.profile.saving") : t("profile.profile.save")}
          </button>
        </div>
      </section>

  <section className={`space-y-3 rounded-3xl border bg-white dark:bg-slate-900 p-6 shadow-inner ${theme.containerBorder}`}>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t("profile.request.heading")}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t("profile.request.description")}</p>
        <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {t("profile.request.label")}
            <select
              className={`mt-1 rounded-xl border bg-surface-2 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 shadow-sm transition hover:border-accent ${theme.inputBorder} ${theme.inputFocusBorder} focus-visible:outline-none`}
              value={role}
              onChange={event => setRole(event.target.value as (typeof ROLES)[number])}
            >
              {ROLES.map(value => (
                <option key={value} value={value}>
                  {t(`roles.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={!account || pending}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${theme.btnPrimary}`}
          >
            {pending ? t("profile.request.pending") : t("profile.request.submit")}
          </button>
        </form>
        {pendingRole && !isApproved && !roleLoading && !isAdmin ? (
          <p className="text-xs text-amber-600 dark:text-amber-300">{t("profile.request.notice")}</p>
        ) : null}
      </section>
    </div>
  );
}

// Helper ensures contract status values respect the dictionary translations.
function translateStatus(status: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const key = `admin.users.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}
