"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isAddress } from "ethers";
import { z } from "zod";

import { useWeb3 } from "@/contexts/Web3Context";
import { useRole } from "@/contexts/RoleContext";
import { useToast } from "@/contexts/ToastContext";
import { useBlockWatcher } from "@/hooks/useBlockWatcher";
import {
  acceptTransfer,
  getTransfer,
  getTokenBalance,
  getTokenView,
  getUserTokens,
  getUserTransfers,
  listUsers,
  rejectTransfer,
  transfer,
  type UserView,
  getUserInfo,
} from "@/lib/sc";
import { useI18n } from "@/contexts/I18nContext";
import { useRoleTheme } from "@/hooks/useRoleTheme";
import { getErrorMessage } from "@/lib/errors";

// Status keys for i18n lookup
const STATUS_KEYS = ["Pending", "Accepted", "Rejected"] as const;
const NEXT_ROLE: Record<string, string | null> = {
  Producer: "Factory",
  Factory: "Retailer",
  Retailer: "Consumer",
  Consumer: null,
};

type TransferRow = { id: number; from: string; to: string; tokenId: number; amount: number; status: number; tokenName?: string; fromDisplay?: string; toDisplay?: string };
type TokenOption = { id: number; available: string; name?: string };
type RecipientOption = { addr: string; role: string; company?: string; firstName?: string; lastName?: string };

export default function TransfersPage() {
  const { account, mustConnect } = useWeb3();
  const { activeRole, isApproved, loading: roleLoading, statusLabel, isAdmin } = useRole();
  const { push } = useToast();
  const { t } = useI18n();
  const { theme } = useRoleTheme();

  const schema = useMemo(
    () =>
      z.object({
        recipient: z.string().refine(isAddress, t("transfers.errors.recipient")),
        tokenId: z.coerce.number().int().min(1, t("transfers.errors.tokenId")),
        amount: z.coerce.bigint().refine(v => v > 0n, t("transfers.errors.amount")),
      }),
    [t]
  );

  const [tokenOptions, setTokenOptions] = useState<TokenOption[]>([]);
  const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [selectedRecipient, setSelectedRecipient] = useState<string>("");
  const [customRecipient, setCustomRecipient] = useState<string>("");
  const [amount, setAmount] = useState<string>("1");
  const [pending, setPending] = useState(false);

  const [incoming, setIncoming] = useState<TransferRow[]>([]);
  const [outgoing, setOutgoing] = useState<TransferRow[]>([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [availableByToken, setAvailableByToken] = useState<Record<number, bigint>>({});

  const nextRole = activeRole ? NEXT_ROLE[activeRole] : undefined;
  const canCreate = Boolean(activeRole && ["Producer", "Factory", "Retailer"].includes(activeRole));

  const refreshTransfers = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!account) {
        setIncoming([]);
        setOutgoing([]);
        return;
      }
      if (!silent) setLoadingTransfers(true);
      try {
        const ids = await getUserTransfers(account);
        const inc: TransferRow[] = [];
        const out: TransferRow[] = [];
        const labelCache: Record<string, string> = {};
        const short = (addr: string) => `${addr.slice(0,6)}…${addr.slice(-4)}`;
        const buildLabel = async (addr: string): Promise<string> => {
          if (labelCache[addr]) return labelCache[addr];
          try {
            const u: any = await getUserInfo(addr);
            // Expect tuple: [id, userAddress, role, pendingRole, status, company, firstName, lastName]
            const company = String(u[5] ?? "").trim();
            const first = String(u[6] ?? "").trim();
            const last = String(u[7] ?? "").trim();
            const name = `${first} ${last}`.trim();
            const composed = [company || undefined, name || undefined].filter(Boolean).join(" • ");
            const label = composed || short(addr);
            labelCache[addr] = label;
            return label;
          } catch {
            const label = short(addr);
            labelCache[addr] = label;
            return label;
          }
        };
        for (const id of ids) {
          try {
            const t = await getTransfer(Number(id));
            const tokenId = Number(t[3]);
            let tokenName: string | undefined = undefined;
            try {
              const tv = await getTokenView(tokenId);
              tokenName = String(tv[2]);
            } catch {}
            const row: TransferRow = {
              id: Number(t[0]),
              from: t[1],
              to: t[2],
              tokenId,
              amount: Number(t[5]),
              status: Number(t[6]),
              tokenName,
            };
            // Attach display labels for origin/destination
            try { row.fromDisplay = await buildLabel(row.from); } catch {}
            try { row.toDisplay = await buildLabel(row.to); } catch {}
            if (row.to.toLowerCase() === account.toLowerCase()) inc.push(row);
            if (row.from.toLowerCase() === account.toLowerCase()) out.push(row);
          } catch (err: unknown) {
            console.error(err);
          }
        }
        // Sort by status first (pending first), then by ID in reverse chronological order (newest first)
        const byStatusThenIdDesc = (a: TransferRow, b: TransferRow) => a.status - b.status || b.id - a.id;
        setIncoming(inc.sort(byStatusThenIdDesc));
        setOutgoing(out.sort(byStatusThenIdDesc));
      } catch (err: unknown) {
        console.error(err);
      } finally {
        if (!silent) setLoadingTransfers(false);
      }
    },
    [account]
  );

  const refreshTokens = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!account) {
        setTokenOptions([]);
        setSelectedToken("");
        return;
      }
      if (!silent) setLoadingTokens(true);
      try {
        const ids = await getUserTokens(account);
        const options: TokenOption[] = [];
        // Build pending outgoing per token to compute "available"
        const pendingMap: Record<number, bigint> = {};
        try {
          const txIds = await getUserTransfers(account);
          for (const rid of txIds) {
            try {
              const v = await getTransfer(Number(rid));
              const from = String(v[1]).toLowerCase();
              const status = Number(v[6]);
              if (from === account.toLowerCase() && status === 0) {
                const tok = Number(v[3]);
                const amt = BigInt(v[5]);
                pendingMap[tok] = (pendingMap[tok] ?? 0n) + amt;
              }
            } catch {}
          }
        } catch {}
        for (const id of ids) {
          try {
            const balance = await getTokenBalance(Number(id), account);
            const asBigInt = BigInt(balance);
            const pending = pendingMap[Number(id)] ?? 0n;
            const available = asBigInt > pending ? asBigInt - pending : 0n;
            if (available > 0n) {
              let name: string | undefined = undefined;
              try {
                const tv = await getTokenView(Number(id));
                name = String(tv[2]);
              } catch {}
              options.push({ id: Number(id), available: available.toString(), name });
            }
          } catch (err) {
            console.error(err);
          }
        }
        setTokenOptions(options);
        setAvailableByToken(Object.fromEntries(options.map(o => [o.id, BigInt(o.available)])));
      } catch (err: unknown) {
        console.error(err);
      } finally {
        if (!silent) setLoadingTokens(false);
      }
    },
    [account]
  );

  const refreshRecipients = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!nextRole) {
        setRecipientOptions([]);
        return;
      }
      if (!silent) setLoadingRecipients(true);
      try {
        const users = await listUsers();
        const approved = users.filter(u => u.status === 1 && u.role === nextRole);
        const opts: RecipientOption[] = approved.map((u: UserView) => ({ addr: u.addr, role: u.role, company: u.company, firstName: u.firstName, lastName: u.lastName }));
        setRecipientOptions(opts);
      } catch (err: unknown) {
        console.error(err);
      } finally {
        if (!silent) setLoadingRecipients(false);
      }
    },
    [nextRole]
  );

  useEffect(() => {
    void refreshTransfers();
  }, [refreshTransfers]);

  useEffect(() => {
    void refreshTokens();
  }, [refreshTokens]);

  useEffect(() => {
    void refreshRecipients();
  }, [refreshRecipients]);

  useBlockWatcher(() => {
    void refreshTransfers({ silent: true });
    void refreshTokens({ silent: true });
    void refreshRecipients({ silent: true });
  }, [refreshTransfers, refreshTokens, refreshRecipients]);

  useEffect(() => {
    if (tokenOptions.length === 0) {
      setSelectedToken("");
      return;
    }
    if (!selectedToken || !tokenOptions.some(opt => String(opt.id) === selectedToken)) {
      setSelectedToken(String(tokenOptions[0].id));
    }
  }, [tokenOptions, selectedToken]);

  useEffect(() => {
    if (recipientOptions.length === 0) {
      if (selectedRecipient !== "__custom") setSelectedRecipient("");
      return;
    }
    if (selectedRecipient && selectedRecipient !== "__custom") {
      const exists = recipientOptions.some(r => r.addr.toLowerCase() === selectedRecipient.toLowerCase());
      if (!exists) setSelectedRecipient(recipientOptions[0].addr);
    } else if (!selectedRecipient) {
      setSelectedRecipient(recipientOptions[0].addr);
    }
  }, [recipientOptions, selectedRecipient]);

  const disabled = !account || pending || mustConnect;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const recipient = selectedRecipient === "__custom" ? customRecipient : selectedRecipient;
    if (!recipient) {
      push("error", t("transfers.errors.noRecipient"));
      return;
    }
    if (!selectedToken) {
      push("error", t("transfers.errors.noToken"));
      return;
    }
    const parsed = schema.safeParse({ recipient, tokenId: selectedToken, amount });
    if (!parsed.success) {
      push("error", parsed.error.issues[0].message);
      return;
    }
    // Additional guard: ensure amount <= available considering pending outgoing transfers
    try {
      const tokId = Number(parsed.data.tokenId);
      const amt = BigInt(parsed.data.amount);
      const available = availableByToken[tokId] ?? 0n;
      if (amt > available) {
        push("error", t("transfers.errors.insufficientAvailable"));
        return;
      }
    } catch {}
    try {
      setPending(true);
      await transfer(parsed.data.recipient, BigInt(parsed.data.tokenId), parsed.data.amount);
      push("success", t("transfers.success.created"));
      await refreshTransfers();
      await refreshTokens({ silent: true });
    } catch (err: unknown) {
      const message = getErrorMessage(err, t("transfers.errors.transaction"));
      if (message) push("error", message);
    } finally {
      setPending(false);
    }
  };

  if (mustConnect) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">{t("transfers.connectPrompt")}</p>;
  }

  if (!roleLoading && !isApproved && !isAdmin) {
    return (
      <div className="rounded-3xl border border-amber-300/60 bg-amber-50/70 p-6 text-sm text-amber-900 shadow-sm dark:border-amber-300/40 dark:bg-amber-500/10 dark:text-amber-100">
        <p className="font-semibold">{t("transfers.notApprovedTitle")}</p>
        <p>{t("transfers.notApprovedBody", { status: statusLabel ?? t("common.status.none") })}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
  <section className={`space-y-4 rounded-3xl border ${theme.accentBorder} bg-white dark:bg-slate-900 p-6 shadow-inner`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t("transfers.title")}</h1>
          {nextRole ? (
            <span className="rounded-full border border-indigo-300/60 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-600 dark:border-indigo-500/40 dark:text-indigo-300">
              {t("transfers.allowedRecipients", { role: nextRole })}
            </span>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">{t("transfers.receiveOnly")}</span>
          )}
        </div>

        {canCreate ? (
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {t("transfers.form.token")}
              <select
                className="mt-1 w-full rounded-xl border border-surface bg-surface-2 px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-slate-200"
                value={selectedToken}
                onChange={event => setSelectedToken(event.target.value)}
              >
                <option value="" disabled>
                  {loadingTokens ? t("transfers.form.loadingTokens") : t("transfers.form.selectToken")}
                </option>
                {tokenOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    #{option.id} — {option.name ?? `Token ${option.id}`} — {option.available}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {t("transfers.form.amount")}
              <input
                className="mt-1 w-full rounded-xl border border-surface bg-surface-2 px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-slate-200"
                value={amount}
                onChange={event => setAmount(event.target.value)}
                placeholder={t("transfers.form.amountPlaceholder")}
                inputMode="numeric"
                min="1"
              />
            </label>

            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 md:col-span-2">
              {t("transfers.form.recipient")}
              <select
                className="mt-1 w-full rounded-xl border border-surface bg-surface-2 px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-slate-200"
                value={selectedRecipient}
                onChange={event => setSelectedRecipient(event.target.value)}
              >
                <option value="" disabled>
                  {loadingRecipients
                    ? t("transfers.form.loadingRecipients")
                    : nextRole
                      ? t("transfers.form.selectRole", { role: nextRole })
                      : t("transfers.form.noRecipients")}
                </option>
                {recipientOptions.map(option => (
                  <option key={option.addr} value={option.addr}>
                    {`${option.company ?? ""}${option.company ? " • " : ""}${(option.firstName || option.lastName) ? `${option.firstName ?? ""} ${option.lastName ?? ""}`.trim() + " • " : ""}${option.addr}`}
                  </option>
                ))}
                <option value="__custom">{t("transfers.form.customRecipient")}</option>
              </select>
            </label>

            {selectedRecipient === "__custom" ? (
              <input
                className="md:col-span-2 rounded-xl border border-surface bg-surface-2 px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-slate-200"
                value={customRecipient}
                onChange={event => setCustomRecipient(event.target.value)}
                placeholder="0x..."
              />
            ) : null}

            <div className="md:col-span-2 flex justify-end">
              <button
                disabled={disabled}
                className="rounded-full bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:brightness-110 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                {pending ? t("transfers.form.creating") : t("transfers.form.submit")}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">{t("transfers.receiveMessage")}</p>
        )}
      </section>

  <section className={`space-y-3 rounded-3xl border ${theme.accentBorder} bg-white dark:bg-slate-900 p-6 shadow-inner`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t("transfers.incoming.title")}</h2>
          <button
            onClick={() => refreshTransfers()}
            disabled={loadingTransfers}
            className="rounded-full border border-surface px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-accent hover:text-accent disabled:opacity-60 dark:text-slate-200"
          >
            {loadingTransfers ? t("transfers.refreshing") : t("transfers.refresh")}
          </button>
        </div>
        <div className="grid gap-3">
          {incoming.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">{t("transfers.incoming.empty")}</p> : null}
          {incoming.map(row => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface bg-surface-2 px-4 py-3 shadow-sm hover:bg-surface-3"
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  #{row.tokenId} · {row.tokenName ?? `Token ${row.tokenId}`} · {row.amount}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("transfers.incoming.from", { address: `${row.fromDisplay ?? row.from}` })}</p>
                <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  row.status === 1 
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300"
                    : row.status === 2
                    ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500 dark:bg-rose-950 dark:text-rose-300"
                    : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-300"
                }`}>
                  {t("transfers.status", { status: t(`dashboard.status.${STATUS_KEYS[row.status as 0 | 1 | 2] ?? String(row.status)}`) })}
                </span>
              </div>
              {row.status === 0 ? (
                <div className="flex gap-2">
                  <button
                    className="rounded-full border border-emerald-400 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-300"
                    onClick={async () => {
                      try {
                        await acceptTransfer(BigInt(row.id));
                        push("success", t("transfers.success.accepted"));
                        await refreshTransfers();
                      } catch (err: unknown) {
                        const message = getErrorMessage(err, t("transfers.errors.operation"));
                        if (message) push("error", message);
                      }
                    }}
                    disabled={!account}
                  >
                    {t("transfers.actions.accept")}
                  </button>
                  <button
                    className="rounded-full border border-rose-400 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 dark:text-rose-300"
                    onClick={async () => {
                      try {
                        await rejectTransfer(BigInt(row.id));
                        push("success", t("transfers.success.rejected"));
                        await refreshTransfers();
                      } catch (err: unknown) {
                        const message = getErrorMessage(err, t("transfers.errors.operation"));
                        if (message) push("error", message);
                      }
                    }}
                    disabled={!account}
                  >
                    {t("transfers.actions.reject")}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

  <section className={`space-y-3 rounded-3xl border ${theme.accentBorder} bg-white dark:bg-slate-900 p-6 shadow-inner`}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t("transfers.outgoing.title")}</h2>
        <div className="grid gap-3">
          {outgoing.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">{t("transfers.outgoing.empty")}</p> : null}
          {outgoing.map(row => (
            <div
              key={row.id}
              className="rounded-2xl border border-surface bg-surface-2 px-4 py-3 shadow-sm hover:bg-surface-3"
            >
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                #{row.tokenId} · {row.tokenName ?? `Token ${row.tokenId}`} · {row.amount}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("transfers.outgoing.to", { address: `${row.toDisplay ?? row.to}` })}</p>
              <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                row.status === 1 
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300"
                  : row.status === 2
                  ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500 dark:bg-rose-950 dark:text-rose-300"
                  : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-300"
              }`}>
                {t("transfers.status", { status: t(`dashboard.status.${STATUS_KEYS[row.status as 0 | 1 | 2] ?? String(row.status)}`) })}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
