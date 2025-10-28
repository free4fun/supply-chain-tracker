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
  getUserTokens,
  getUserTransfers,
  listUsers,
  rejectTransfer,
  transfer,
  type UserView,
} from "@/lib/sc";
import { useI18n } from "@/contexts/I18nContext";

const STATUS_LABELS = ["Pending", "Accepted", "Rejected"] as const;
const NEXT_ROLE: Record<string, string | null> = {
  Producer: "Factory",
  Factory: "Retailer",
  Retailer: "Consumer",
  Consumer: null,
};

type TransferRow = { id: number; from: string; to: string; tokenId: number; amount: number; status: number };
type TokenOption = { id: number; balance: string };
type RecipientOption = { addr: string; role: string };

export default function TransfersPage() {
  const { account, mustConnect } = useWeb3();
  const { activeRole, isApproved, loading: roleLoading, statusLabel, isAdmin } = useRole();
  const { push } = useToast();
  const { t } = useI18n();

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
        for (const id of ids) {
          try {
            const t = await getTransfer(Number(id));
            const row: TransferRow = {
              id: Number(t[0]),
              from: t[1],
              to: t[2],
              tokenId: Number(t[3]),
              amount: Number(t[5]),
              status: Number(t[6]),
            };
            if (row.to.toLowerCase() === account.toLowerCase()) inc.push(row);
            if (row.from.toLowerCase() === account.toLowerCase()) out.push(row);
          } catch (err: unknown) {
            console.error(err);
          }
        }
        const byStatus = (a: TransferRow, b: TransferRow) => a.status - b.status || a.id - b.id;
        setIncoming(inc.sort(byStatus));
        setOutgoing(out.sort(byStatus));
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
        for (const id of ids) {
          try {
            const balance = await getTokenBalance(Number(id), account);
            const asBigInt = BigInt(balance);
            if (asBigInt > 0n) {
              options.push({ id: Number(id), balance: asBigInt.toString() });
            }
          } catch (err) {
            console.error(err);
          }
        }
        setTokenOptions(options);
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
        const opts: RecipientOption[] = approved.map((u: UserView) => ({ addr: u.addr, role: u.role }));
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
    try {
      setPending(true);
      await transfer(parsed.data.recipient, BigInt(parsed.data.tokenId), parsed.data.amount);
      push("success", t("transfers.success.created"));
      await refreshTransfers();
      await refreshTokens({ silent: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("transfers.errors.transaction");
      push("error", message);
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
      <section className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/80">
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
                className="mt-1 w-full rounded-xl border border-slate-300/70 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                value={selectedToken}
                onChange={event => setSelectedToken(event.target.value)}
              >
                <option value="" disabled>
                  {loadingTokens ? t("transfers.form.loadingTokens") : t("transfers.form.selectToken")}
                </option>
                {tokenOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    #{option.id} — Balance {option.balance}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {t("transfers.form.amount")}
              <input
                className="mt-1 w-full rounded-xl border border-slate-300/70 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
                className="mt-1 w-full rounded-xl border border-slate-300/70 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
                    {option.addr}
                  </option>
                ))}
                <option value="__custom">{t("transfers.form.customRecipient")}</option>
              </select>
            </label>

            {selectedRecipient === "__custom" ? (
              <input
                className="md:col-span-2 rounded-xl border border-slate-300/70 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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

      <section className="space-y-3 rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/80">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t("transfers.incoming.title")}</h2>
          <button
            onClick={() => refreshTransfers()}
            disabled={loadingTransfers}
            className="rounded-full border border-slate-300/70 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
          >
            {loadingTransfers ? t("transfers.refreshing") : t("transfers.refresh")}
          </button>
        </div>
        <div className="grid gap-3">
          {incoming.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">{t("transfers.incoming.empty")}</p> : null}
          {incoming.map(row => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("transfers.incoming.rowTitle", { id: row.id, token: row.tokenId, amount: row.amount })}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("transfers.incoming.from", { address: row.from })}</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-300">{t("transfers.status", { status: STATUS_LABELS[row.status as 0 | 1 | 2] ?? String(row.status) })}</p>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-full border border-slate-300/70 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-green-400 hover:text-green-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
                  onClick={async () => {
                    try {
                      await acceptTransfer(BigInt(row.id));
                      push("success", t("transfers.success.accepted"));
                      await refreshTransfers();
                    } catch (err: unknown) {
                      const message = err instanceof Error ? err.message : t("transfers.errors.operation");
                      push("error", message);
                    }
                  }}
                  disabled={row.status !== 0 || !account}
                >
                  {t("transfers.actions.accept")}
                </button>
                <button
                  className="rounded-full border border-slate-300/70 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-rose-400 hover:text-rose-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
                  onClick={async () => {
                    try {
                      await rejectTransfer(BigInt(row.id));
                      push("success", t("transfers.success.rejected"));
                      await refreshTransfers();
                    } catch (err: unknown) {
                      const message = err instanceof Error ? err.message : t("transfers.errors.operation");
                      push("error", message);
                    }
                  }}
                  disabled={row.status !== 0 || !account}
                >
                  {t("transfers.actions.reject")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/80">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t("transfers.outgoing.title")}</h2>
        <div className="grid gap-3">
          {outgoing.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">{t("transfers.outgoing.empty")}</p> : null}
          {outgoing.map(row => (
            <div
              key={row.id}
              className="rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
            >
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("transfers.outgoing.rowTitle", { id: row.id, token: row.tokenId, amount: row.amount })}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("transfers.outgoing.to", { address: row.to })}</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-300">{t("transfers.status", { status: STATUS_LABELS[row.status as 0 | 1 | 2] ?? String(row.status) })}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
