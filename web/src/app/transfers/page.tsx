"use client";

import { useCallback, useEffect, useState } from "react";
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

const STATUS_LABELS = ["Pending", "Accepted", "Rejected"] as const;
const NEXT_ROLE: Record<string, string | null> = {
  Producer: "Factory",
  Factory: "Retailer",
  Retailer: "Consumer",
  Consumer: null,
};

const schema = z.object({
  recipient: z.string().refine(isAddress, "Invalid recipient"),
  tokenId: z.coerce.number().int().min(1, "Token ID must be >= 1"),
  amount: z.coerce.bigint().refine(v => v > 0n, "Amount must be > 0"),
});

type TransferRow = { id: number; from: string; to: string; tokenId: number; amount: number; status: number };
type TokenOption = { id: number; balance: string };
type RecipientOption = { addr: string; role: string };

export default function TransfersPage() {
  const { account, mustConnect } = useWeb3();
  const { activeRole, isApproved, loading: roleLoading, statusLabel, isAdmin } = useRole();
  const { push } = useToast();

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
            options.push({ id: Number(id), balance: balance.toString() });
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
      push("error", "Seleccioná un destinatario");
      return;
    }
    if (!selectedToken) {
      push("error", "Elegí un token para transferir");
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
      push("success", "Transfer created");
      await refreshTransfers();
      await refreshTokens({ silent: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      push("error", message);
    } finally {
      setPending(false);
    }
  };

  if (mustConnect) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">Conectá tu wallet para gestionar transferencias.</p>;
  }

  if (!roleLoading && !isApproved && !isAdmin) {
    return (
      <div className="rounded-3xl border border-amber-300/60 bg-amber-50/70 p-6 text-sm text-amber-900 shadow-sm dark:border-amber-300/40 dark:bg-amber-500/10 dark:text-amber-100">
        <p className="font-semibold">Tu cuenta no está aprobada para realizar transferencias.</p>
        <p>Estado actual: {statusLabel ?? "Sin registro"}. Gestioná tu rol desde la sección Perfil.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Nueva transferencia</h1>
          {nextRole ? (
            <span className="rounded-full border border-indigo-300/60 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-600 dark:border-indigo-500/40 dark:text-indigo-300">
              Destinatarios habilitados: {nextRole}
            </span>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">Este rol sólo recibe transferencias.</span>
          )}
        </div>

        {canCreate ? (
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Token disponible
              <select
                className="mt-1 w-full rounded-xl border border-slate-300/70 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                value={selectedToken}
                onChange={event => setSelectedToken(event.target.value)}
              >
                <option value="" disabled>
                  {loadingTokens ? "Cargando..." : "Seleccioná un token"}
                </option>
                {tokenOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    #{option.id} — Balance {option.balance}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Cantidad a transferir
              <input
                className="mt-1 w-full rounded-xl border border-slate-300/70 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                value={amount}
                onChange={event => setAmount(event.target.value)}
                placeholder="Cantidad"
                inputMode="numeric"
                min="1"
              />
            </label>

            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 md:col-span-2">
              Destinatario
              <select
                className="mt-1 w-full rounded-xl border border-slate-300/70 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                value={selectedRecipient}
                onChange={event => setSelectedRecipient(event.target.value)}
              >
                <option value="" disabled>
                  {loadingRecipients ? "Cargando destinatarios..." : nextRole ? `Seleccioná un ${nextRole}` : "Sin destinatarios"}
                </option>
                {recipientOptions.map(option => (
                  <option key={option.addr} value={option.addr}>
                    {option.addr}
                  </option>
                ))}
                <option value="__custom">Ingresar dirección manualmente…</option>
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
                {pending ? "Creando…" : "Crear transferencia"}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Este rol sólo puede recibir transferencias. Revisá el panel de Entrantes para aceptar o rechazar envíos pendientes.
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/80">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Entrantes</h2>
          <button
            onClick={() => refreshTransfers()}
            disabled={loadingTransfers}
            className="rounded-full border border-slate-300/70 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
          >
            {loadingTransfers ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
        <div className="grid gap-3">
          {incoming.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No hay transferencias entrantes.</p> : null}
          {incoming.map(row => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  #{row.id} · Token {row.tokenId} · Cantidad {row.amount}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Desde {row.from}</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-300">Estado: {STATUS_LABELS[row.status as 0 | 1 | 2] ?? row.status}</p>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-full border border-slate-300/70 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-green-400 hover:text-green-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
                  onClick={async () => {
                    try {
                      await acceptTransfer(BigInt(row.id));
                      push("success", "Transfer accepted");
                      await refreshTransfers();
                    } catch (err: unknown) {
                      const message = err instanceof Error ? err.message : "Operation failed";
                      push("error", message);
                    }
                  }}
                  disabled={row.status !== 0 || !account}
                >
                  Aceptar
                </button>
                <button
                  className="rounded-full border border-slate-300/70 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-rose-400 hover:text-rose-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
                  onClick={async () => {
                    try {
                      await rejectTransfer(BigInt(row.id));
                      push("success", "Transfer rejected");
                      await refreshTransfers();
                    } catch (err: unknown) {
                      const message = err instanceof Error ? err.message : "Operation failed";
                      push("error", message);
                    }
                  }}
                  disabled={row.status !== 0 || !account}
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/80">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Salientes</h2>
        <div className="grid gap-3">
          {outgoing.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No hay transferencias salientes.</p> : null}
          {outgoing.map(row => (
            <div
              key={row.id}
              className="rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
            >
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                #{row.id} · Token {row.tokenId} · Cantidad {row.amount}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Para {row.to}</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-300">Estado: {STATUS_LABELS[row.status as 0 | 1 | 2] ?? row.status}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
