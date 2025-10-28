"use client";
import { useEffect, useMemo, useState } from "react";
import { changeStatusUser, scAdmin } from "@/lib/sc";
import { isAddress } from "ethers";
import { useWeb3 } from "@/contexts/Web3Context";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/contexts/I18nContext";

const ADMIN_ENV = (process.env.NEXT_PUBLIC_ADMIN_ADDRESS || "").toLowerCase();

export default function AdminPage() {
  const { account, mustConnect, reconnect, switchAcc } = useWeb3();
  const { push } = useToast();
  const { t } = useI18n();

  const [onchainAdmin, setOnchainAdmin] = useState("");
  const [addr, setAddr] = useState("");
  const [status, setStatus] = useState(1);
  const [pending, setPending] = useState(false);

  const isAdmin = useMemo(() => {
    const a = (account || "").toLowerCase();
    return a && (a === ADMIN_ENV);
  }, [account]);

  useEffect(() => { scAdmin().then(setOnchainAdmin).catch(()=>{}); }, []);

  if (mustConnect)
    return (
  <div className="space-y-2 rounded-3xl border border-surface bg-surface-2 p-6 shadow-inner">
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("admin.page.connectPrompt")}</p>
        <div className="flex gap-2">
          <button onClick={reconnect} className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-110 btn-primary focus-outline-accent">{t("admin.page.connectButton")}</button>
          <button onClick={switchAcc} className="rounded-full border border-slate-300/70 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-accent focus-outline-accent dark:border-slate-700 dark:text-slate-200">{t("admin.page.switchButton")}</button>
        </div>
      </div>
    );

  if (!isAdmin)
    return (
  <div className="space-y-3 rounded-3xl border border-surface bg-surface-2 p-6 shadow-inner">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t("admin.page.title")}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("admin.page.currentAccount", { account: account || t("admin.page.unknown") })}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("admin.page.onlyAdmin")}</p>
        <button onClick={switchAcc} className="rounded-full border border-slate-300/70 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-accent focus-outline-accent dark:border-slate-700 dark:text-slate-200">{t("admin.page.switchAdmin")}</button>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t("admin.page.envAdmin", { address: process.env.NEXT_PUBLIC_ADMIN_ADDRESS || t("admin.page.unknown") })}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t("admin.page.onchainAdmin", { address: onchainAdmin || t("admin.page.unknown") })}</p>
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAddress(addr)) return push("error", t("admin.page.errors.address"));
    try {
      setPending(true);
      await changeStatusUser(addr, status);
      push("success", t("admin.page.success"));
    } catch (e:any) { push("error", e?.message || t("admin.page.txFailed")); }
    finally { setPending(false); }
  }

  return (
  <div className="space-y-4 rounded-3xl border border-surface bg-surface-2 p-6 shadow-inner">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t("admin.page.title")}</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">{t("admin.page.envAdmin", { address: process.env.NEXT_PUBLIC_ADMIN_ADDRESS || t("admin.page.unknown") })}</p>
      <p className="text-sm text-slate-600 dark:text-slate-300">{t("admin.page.onchainAdmin", { address: onchainAdmin || t("admin.page.unknown") })}</p>

      <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
        <input 
          className="rounded-xl border border-slate-300/70 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-accent focus-outline-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 min-w-[22rem]" 
          placeholder="0x..." 
          value={addr} 
          onChange={e=>setAddr(e.target.value)} 
        />
        <select 
          className="rounded-xl border border-slate-300/70 bg-white px-3 py-2 text-sm font-semibold shadow-sm transition hover:border-accent focus-outline-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" 
          value={status} 
          onChange={e=>setStatus(+e.target.value)}
        >
          <option value={0}>Pending</option><option value={1}>Approved</option>
          <option value={2}>Rejected</option><option value={3}>Canceled</option>
        </select>
        <button 
          disabled={pending} 
          className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-110 disabled:opacity-60 btn-primary focus-outline-accent"
        >
          {pending ? t("admin.page.updating") : t("admin.page.update")}
        </button>
      </form>
    </div>
  );
}
