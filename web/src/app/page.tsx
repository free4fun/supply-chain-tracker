// web/src/app/page.tsx
"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useWeb3 } from "@/contexts/Web3Context";
import { useRole } from "@/contexts/RoleContext";
import { useI18n } from "@/contexts/I18nContext";

// Configuration driven by translation keys so role content stays localized.
type RoleGuideConfig = {
  descriptionKey: string;
  stepKeys: readonly string[];
  actions: readonly { href: string; labelKey: string }[];
};

const ROLE_GUIDES: Record<string, RoleGuideConfig> = {
  Producer: {
    descriptionKey: "landing.roles.producer.description",
    stepKeys: [
      "landing.roles.producer.steps.1",
      "landing.roles.producer.steps.2",
      "landing.roles.producer.steps.3",
    ],
    actions: [
      { href: "/tokens/create", labelKey: "landing.roles.producer.actions.create" },
      { href: "/transfers", labelKey: "landing.roles.producer.actions.transfer" },
    ],
  },
  Factory: {
    descriptionKey: "landing.roles.factory.description",
    stepKeys: [
      "landing.roles.factory.steps.1",
      "landing.roles.factory.steps.2",
      "landing.roles.factory.steps.3",
    ],
    actions: [
      { href: "/tokens/create", labelKey: "landing.roles.factory.actions.create" },
      { href: "/transfers", labelKey: "landing.roles.factory.actions.transfer" },
    ],
  },
  Retailer: {
    descriptionKey: "landing.roles.retailer.description",
    stepKeys: [
      "landing.roles.retailer.steps.1",
      "landing.roles.retailer.steps.2",
      "landing.roles.retailer.steps.3",
    ],
    actions: [
      { href: "/transfers", labelKey: "landing.roles.retailer.actions.transfer" },
      { href: "/dashboard", labelKey: "landing.roles.retailer.actions.dashboard" },
    ],
  },
  Consumer: {
    descriptionKey: "landing.roles.consumer.description",
    stepKeys: [
      "landing.roles.consumer.steps.1",
      "landing.roles.consumer.steps.2",
      "landing.roles.consumer.steps.3",
    ],
    actions: [{ href: "/dashboard", labelKey: "landing.roles.consumer.actions.trace" }],
  },
  Admin: {
    descriptionKey: "landing.roles.admin.description",
    stepKeys: [
      "landing.roles.admin.steps.1",
      "landing.roles.admin.steps.2",
      "landing.roles.admin.steps.3",
    ],
    actions: [{ href: "/admin/users", labelKey: "landing.roles.admin.actions.manage" }],
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
  const { t } = useI18n();
  const guide = ROLE_GUIDES[selectedRole];
  const isCurrentRole = derivedRole ? selectedRole === derivedRole : false;
  const lastRequestText = lastRequestedAt ? new Date(lastRequestedAt * 1000).toLocaleString() : undefined;
  const translatedStatus = statusLabel ? translateStatus(statusLabel, t) : t("common.status.none");
  const selectedRoleLabel = t(`roles.${selectedRole}`);
  const lastRequestedRoleLabel = lastRequestedRole ? t(`roles.${lastRequestedRole}`) : undefined;

  return (
  <section className="grid gap-6 rounded-[24px] border border-surface bg-surface-1 p-8 shadow-[0_14px_45px_-32px_rgba(15,23,42,0.65)] backdrop-blur-md">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t("landing.workflow.title")}</h2>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">{t("landing.workflow.description")}</p>
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          {t("landing.workflow.selectLabel")}
          <select
            className="rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-accent focus-outline-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            value={selectedRole}
            onChange={event => setSelectedRole(event.target.value as RoleKey)}
          >
            {roleOptions.map(option => (
              <option key={option} value={option}>
                {t(`roles.${option}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

  <div className="grid gap-6 rounded-3xl border border-surface bg-surface-2 p-6 shadow-inner">
        <div className="flex flex-col gap-2">
          <span className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold chip-soft border border-accent">
            {selectedRoleLabel}
            {isCurrentRole && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent">
                {t("landing.workflow.currentRoleBadge")}
              </span>
            )}
          </span>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t(guide.descriptionKey)}</p>
          {lastRequestedRole && !derivedRole ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("landing.workflow.lastRequest", { role: lastRequestedRoleLabel ?? lastRequestedRole })}
              {lastRequestText ? t("landing.workflow.lastRequestTime", { time: lastRequestText }) : ""}
            </p>
          ) : null}
        </div>

        <ol className="grid gap-3 text-sm text-slate-700 dark:text-slate-200 md:grid-cols-3">
          {guide.stepKeys.map((stepKey, index) => (
            <li
              key={stepKey}
              className="rounded-2xl border border-surface bg-surface-3 px-4 py-3 font-medium shadow-sm hover:bg-surface-3"
            >
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-accent">
                {index + 1}
              </span>
              {t(stepKey)}
            </li>
          ))}
        </ol>

        {guide.actions.length ? (
          <div className="flex flex-wrap items-center gap-3">
            {guide.actions.map(action => (
              isCurrentRole ? (
                <Link
                  key={action.href}
                  href={action.href}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-110 btn-primary focus-outline-accent"
                >
                  {t(action.labelKey)}
                </Link>
              ) : (
                <span
                  key={action.href}
                  className="rounded-full border border-slate-200/80 px-4 py-2 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400"
                >
                  {t(action.labelKey)}
                </span>
              )
            ))}
            {!isCurrentRole && (
              <span className="text-xs text-slate-500 dark:text-slate-400">{t("landing.workflow.connectHint")}</span>
            )}
          </div>
        ) : null}

        {!isApproved && !roleLoading && selectedRole !== "Admin" && (
          <p className="text-xs text-amber-600 dark:text-amber-300">
            {t("landing.workflow.statusHint", { status: translatedStatus })}
          </p>
        )}
      </div>
    </section>
  );
}

export default function Page() {
  const { t } = useI18n();
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

  const translatedActiveRole = activeRole ? t(`roles.${activeRole}`) : undefined;
  const translatedLastRequestedRole = validLastRequestedRole ? t(`roles.${validLastRequestedRole}`) : undefined;
  const translatedStatus = statusLabel ? translateStatus(statusLabel, t) : t("common.status.none");

  const roleLabel = roleLoading
    ? t("common.loading.sync")
    : isAdmin
      ? t("roles.Admin")
      : translatedActiveRole
        ? translatedActiveRole
        : validLastRequestedRole
          ? `${translatedLastRequestedRole ?? lastRequestedRole}${t("landing.connection.role.requestedSuffix")}`
          : t("landing.connection.role.none");

  const roleStatusText = roleLoading
    ? ""
    : isAdmin
      ? t("landing.connection.role.adminStatus")
      : statusLabel
        ? t("landing.connection.role.status", { status: translatedStatus })
        : t("landing.connection.role.requestAccess");

  return (
    <main className="relative isolate mx-auto flex w-full max-w-6xl flex-col gap-10 p-6 md:p-10">
  <div className="absolute inset-0 -z-10 overflow-hidden rounded-[32px] border border-surface bg-surface-1 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.45)] backdrop-blur-xl" />

  <section className="grid gap-10 rounded-[28px] border border-surface bg-surface-2 p-8 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.5)] backdrop-blur-md md:grid-cols-[1.2fr,1fr] md:p-12">
        <div className="space-y-6 text-slate-900 dark:text-slate-100">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1 text-sm font-medium chip-soft border border-accent">
            {t("landing.hero.badge")}
          </span>
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl dark:text-white">
              {t("landing.hero.title")}
            </h1>
            <p className="max-w-xl text-base text-slate-600 md:text-lg dark:text-slate-300">{t("landing.hero.subtitle")}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={reconnect}
              className="rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 btn-primary focus-outline-accent"
              disabled={!ready}
            >
              {account ? t("landing.hero.primary.reconnect") : t("landing.hero.primary.connect")}
            </button>
            <button
              onClick={switchAcc}
              className="rounded-full border border-slate-300/60 px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-accent hover:text-accent focus-outline-accent dark:border-slate-700 dark:text-slate-200"
              disabled={!ready}
            >
              {t("landing.hero.secondary")}
            </button>
            {mustConnect && (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/60 bg-amber-100/60 px-4 py-2 text-xs font-medium text-amber-700 dark:border-amber-300/50 dark:bg-amber-500/10 dark:text-amber-200">
                {t("landing.hero.requirement")}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-2xl">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-300">{t("landing.status.cardTitle")}</p>
            <div className="mt-5 space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-400">{t("landing.status.walletLabel")}</p>
                <p className="truncate text-lg font-semibold">
                  {!ready ? t("landing.status.initializing") : account ? account : t("landing.status.noWallet")}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400">{t("landing.status.networkLabel")}</p>
                <p className="text-lg font-semibold">{chainId ? t("landing.status.networkValue", { chainId }) : t("landing.status.detecting")}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400">{t("landing.status.roleLabel")}</p>
                <p className="text-lg font-semibold">{roleLabel}</p>
                {roleStatusText && <p className="text-xs text-slate-400">{roleStatusText}</p>}
              </div>
              {error && <div className="rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div>}
            </div>
          </div>

          <div className="grid gap-3 rounded-3xl border border-surface bg-surface-2 p-6 text-slate-900 shadow-inner backdrop-blur-sm dark:text-slate-100">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t("landing.steps.title")}</p>
            <ol className="grid gap-3 text-sm md:text-base">
              {["landing.steps.1", "landing.steps.2", "landing.steps.3"].map(stepKey => (
                <li
                  key={stepKey}
                  className="rounded-2xl bg-surface-3 px-4 py-3 font-medium text-slate-700 hover:bg-surface-3 dark:text-slate-200"
                >
                  {t(stepKey)}
                </li>
              ))}
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

  <section className="grid gap-4 rounded-[24px] border border-surface bg-surface-2 p-8 shadow-[0_12px_40px_-30px_rgba(15,23,42,0.7)] backdrop-blur-md">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t("landing.features.title")}</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              titleKey: "landing.features.unified.title",
              descriptionKey: "landing.features.unified.description",
            },
            {
              titleKey: "landing.features.intelligence.title",
              descriptionKey: "landing.features.intelligence.description",
            },
            {
              titleKey: "landing.features.alignment.title",
              descriptionKey: "landing.features.alignment.description",
            },
          ].map(feature => (
            <article
              key={feature.titleKey}
              className="group rounded-3xl border border-surface bg-surface-3 p-6 transition hover:-translate-y-1 hover:border-accent hover:bg-surface-3 hover:shadow-xl"
            >
              <h3 className="text-lg font-semibold text-slate-900 transition group-hover:text-accent dark:text-white">
                {t(feature.titleKey)}
              </h3>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{t(feature.descriptionKey)}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

// Helper dedicated to translating admin status strings that originate from the smart contract or backend.
function translateStatus(status: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const key = `admin.users.status.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}
