"use client";
import { useEffect, useMemo, useState } from "react";
import { changeStatusUser } from "@/lib/sc";
import { listUsers, lastRoleRequestByUser, type UserView } from "@/lib/sc";
import { useWeb3 } from "@/contexts/Web3Context";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/contexts/I18nContext";

const ADMIN_ENV = (process.env.NEXT_PUBLIC_ADMIN_ADDRESS || "").toLowerCase();
const STATUS_KEYS = ["Pending", "Approved", "Rejected", "Canceled"] as const;

type Row = UserView & { lastRole?: string; lastAt?: number };

export default function AdminUsersPage() {
    const { account, mustConnect, reconnect, switchAcc } = useWeb3();
    const { push } = useToast();
    const { t } = useI18n();
    const isAdmin = useMemo(() => (account||"").toLowerCase() === ADMIN_ENV, [account]);
    const [rows, setRows] = useState<Row[]>([]);
    const [onlyPending, setOnlyPending] = useState(true);
    const [loading, setLoading] = useState(false);

    async function load() {
        setLoading(true);
        try {
        const [users, lastReqIdx] = await Promise.all([listUsers(), lastRoleRequestByUser()]);
        const merged: Row[] = users.map(u => {
            const req = lastReqIdx[u.addr.toLowerCase()];
            return { ...u, lastRole: req?.role, lastAt: req?.timestamp };
        });
        setRows(merged.sort((a,b) => (b.lastAt||0)-(a.lastAt||0)));
        } catch (e:any) { push("error", e?.message || t("admin.users.loadFailed")); }
        finally { setLoading(false); }
    }

    useEffect(() => { 
        if (!account) return;
        load(); 
    }, [account]);

    if (mustConnect)
        return (
        <div className="space-y-2">
            <p className="text-sm">{t("admin.users.connectPrompt")}</p>
            <div className="flex gap-2">
            <button onClick={reconnect} className="px-3 py-1 rounded bg-black text-white">{t("admin.users.connectButton")}</button>
            <button onClick={switchAcc} className="px-3 py-1 rounded border">{t("admin.users.switchButton")}</button>
            </div>
        </div>
        );

    if (!isAdmin)
        return (
        <div className="space-y-2">
            <h1 className="text-xl font-semibold">{t("admin.users.title")}</h1>
            <p className="text-sm">{t("admin.users.onlyAdmin")}</p>
            <button onClick={switchAcc} className="px-3 py-1 rounded border">{t("admin.users.switchAdmin")}</button>
        </div>
        );
    const badAddr = !(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS && /^0x[0-9a-fA-F]{40}$/.test(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS));
    if (badAddr) {
        return <p className="text-sm text-red-600">{t("admin.users.missingConfig")}</p>;
    }

    async function act(addr: string, s: number) {
        try {
            await changeStatusUser(addr, s);
            push("success", t("admin.users.statusUpdated", { status: t(`admin.users.status.${STATUS_KEYS[s as 0|1|2|3]}`) }));
            await load();
        } catch (e:any) { push("error", e?.message || t("admin.users.txFailed")); }
    }

    const data = rows.filter(r => (onlyPending ? r.status === 0 : true));
    return (
        <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">{t("admin.users.title")}</h1>
            <div className="flex items-center gap-3">
            <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={onlyPending} onChange={e=>setOnlyPending(e.target.checked)} /> {t("admin.users.onlyPending")}
            </label>
            <button onClick={load} disabled={loading} className="px-3 py-1 rounded border">{loading ? t("admin.users.loading") : t("admin.users.refresh")}</button>
            </div>
        </div>

        <div className="grid grid-cols-12 gap-2 text-sm font-medium px-2">
            <div className="col-span-4">{t("admin.users.headers.address")}</div>
            <div className="col-span-2">{t("admin.users.headers.role")}</div>
            <div className="col-span-2">{t("admin.users.headers.status")}</div>
            <div className="col-span-2">{t("admin.users.headers.lastRequest")}</div>
            <div className="col-span-2">{t("admin.users.headers.actions")}</div>
        </div>
        <div className="divide-y">
            {data.length===0 && <p className="text-sm p-2">{t("admin.users.empty")}</p>}
            {data.map(r => (
            <div key={r.id} className="grid grid-cols-12 gap-2 items-center p-2">
                <div className="col-span-4 break-all">{r.addr}</div>
                <div className="col-span-2">{r.role || "-"}</div>
                <div className={`col-span-2 ${r.status===0?"text-yellow-700":r.status===1?"text-green-700":r.status===2?"text-red-700":"text-gray-600"}`}>
                {t(`admin.users.status.${STATUS_KEYS[r.status as 0|1|2|3]}`)}
                </div>
                <div className="col-span-2">
                {r.lastRole ? (
                    <>
                    <div>{r.lastRole}</div>
                    {r.lastAt ? <div className="text-xs text-gray-500">{new Date(r.lastAt*1000).toLocaleString()}</div> : null}
                    </>
                ) : <span className="text-gray-400">-</span>}
                </div>
                <div className="col-span-2 flex gap-1">
                <button className="px-2 py-1 rounded border" onClick={()=>act(r.addr, 1)} disabled={r.status!==0}>{t("admin.users.actions.approve")}</button>
                <button className="px-2 py-1 rounded border" onClick={()=>act(r.addr, 2)} disabled={r.status!==0}>{t("admin.users.actions.reject")}</button>
                <button className="px-2 py-1 rounded border" onClick={()=>act(r.addr, 3)} disabled={r.status!==0}>{t("admin.users.actions.cancel")}</button>
                </div>
            </div>
            ))}
        </div>
        </div>
    );
}
