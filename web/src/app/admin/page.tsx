"use client";
import { useEffect, useMemo, useState } from "react";
import { changeStatusUser, scAdmin } from "@/lib/sc";
import { handleBlockOutOfRange } from "@/lib/blockOutOfRange";
import { isAddress } from "ethers";
import { useWeb3 } from "@/contexts/Web3Context";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/contexts/I18nContext";
import { getErrorMessage } from "@/lib/errors";

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

  useEffect(() => {
    scAdmin().then(setOnchainAdmin).catch((err) => { handleBlockOutOfRange(err); });
  }, []);

  if (mustConnect)
    return (
      <div className="space-y-2">
        <p className="text-sm">{t("admin.page.connectPrompt")}</p>
        <div className="flex gap-2">
          <button onClick={reconnect} className="px-3 py-1 rounded bg-black text-white">{t("admin.page.connectButton")}</button>
          <button onClick={switchAcc} className="px-3 py-1 rounded border">{t("admin.page.switchButton")}</button>
        </div>
      </div>
    );

  if (!isAdmin)
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{t("admin.page.title")}</h1>
        <p className="text-sm">{t("admin.page.currentAccount", { account: account || t("admin.page.unknown") })}</p>
        <p className="text-sm">{t("admin.page.onlyAdmin")}</p>
        <button onClick={switchAcc} className="px-3 py-1 rounded border">{t("admin.page.switchAdmin")}</button>
        <p className="text-xs text-gray-500 mt-2">{t("admin.page.envAdmin", { address: process.env.NEXT_PUBLIC_ADMIN_ADDRESS || t("admin.page.unknown") })}</p>
        <p className="text-xs text-gray-500">{t("admin.page.onchainAdmin", { address: onchainAdmin || t("admin.page.unknown") })}</p>
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAddress(addr)) return push("error", t("admin.page.errors.address"));
    try {
      setPending(true);
      await changeStatusUser(addr, status).catch((err) => { if (!handleBlockOutOfRange(err)) throw err; });
      push("success", t("admin.page.success"));
    } catch (e:any) { 
      const message = getErrorMessage(e, t("admin.page.txFailed"));
      if (message) push("error", message);
    }
    finally { setPending(false); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("admin.page.title")}</h1>
      <p className="text-sm">{t("admin.page.envAdmin", { address: process.env.NEXT_PUBLIC_ADMIN_ADDRESS || t("admin.page.unknown") })}</p>
      <p className="text-sm">{t("admin.page.onchainAdmin", { address: onchainAdmin || t("admin.page.unknown") })}</p>

      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input className="border px-2 py-1 rounded min-w-[22rem]" placeholder="0x..." value={addr} onChange={e=>setAddr(e.target.value)} />
        <select className="border px-2 py-1 rounded" value={status} onChange={e=>setStatus(+e.target.value)}>
          <option value={0}>Pending</option><option value={1}>Approved</option>
          <option value={2}>Rejected</option><option value={3}>Canceled</option>
        </select>
        <button disabled={pending} className="px-3 py-1 rounded bg-black text-white disabled:opacity-60">
          {pending ? t("admin.page.updating") : t("admin.page.update")}
        </button>
      </form>
    </div>
  );
}
