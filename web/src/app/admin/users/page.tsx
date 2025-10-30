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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

        <div className="divide-y border-t border-b border-surface">
            {data.length===0 && <p className="text-sm p-2">{t("admin.users.empty")}</p>}
            {data.map(r => (
            <div key={r.id} className="p-4 space-y-3 bg-surface-1 rounded-2xl border border-surface">
                <div className="grid grid-cols-12 gap-3 items-start text-sm">
                    <div className="col-span-4 space-y-1">
                        <div className="font-medium text-slate-500 dark:text-slate-400 text-xs">{t("admin.users.headers.address")}</div>
                        <div className="break-all font-mono text-xs bg-surface-2 px-2 py-1 rounded">{r.addr}</div>
                    </div>
                    <div className="col-span-2 space-y-1">
                        <div className="font-medium text-slate-500 dark:text-slate-400 text-xs">{t("admin.users.headers.role")}</div>
                        <div className="font-semibold">{r.role ? (t(`roles.${r.role}`) !== `roles.${r.role}` ? t(`roles.${r.role}`) : r.role) : "-"}</div>
                        {r.pendingRole && r.pendingRole !== r.role ? (
                            <div className="text-xs text-amber-600 dark:text-amber-400">
                                {t("admin.users.pendingRole")}: {(t(`roles.${r.pendingRole}`) !== `roles.${r.pendingRole}`) ? t(`roles.${r.pendingRole}`) : r.pendingRole}
                            </div>
                        ) : null}
                    </div>
                    <div className="col-span-2 space-y-1">
                        <div className="font-medium text-slate-500 dark:text-slate-400 text-xs">{t("admin.users.headers.status")}</div>
                        <div className={`font-semibold ${r.status===0?"text-yellow-700 dark:text-yellow-500":r.status===1?"text-green-700 dark:text-green-500":r.status===2?"text-red-700 dark:text-red-500":"text-gray-600 dark:text-gray-400"}`}>
                            {t(`admin.users.status.${STATUS_KEYS[r.status as 0|1|2|3]}`)}
                        </div>
                    </div>
                    <div className="col-span-2 space-y-1">
                        <div className="font-medium text-slate-500 dark:text-slate-400 text-xs">{t("admin.users.headers.lastRequest")}</div>
                        {r.lastRole ? (
                            <>
                            <div className="font-semibold">{(t(`roles.${r.lastRole}`) !== `roles.${r.lastRole}`) ? t(`roles.${r.lastRole}`) : r.lastRole}</div>
                            {r.lastAt ? <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(r.lastAt*1000).toLocaleString("en-US", { timeZone: "UTC" })}</div> : null}
                            </>
                        ) : <span className="text-gray-400">-</span>}
                    </div>
                    <div className="col-span-2 space-y-1">
                        <div className="font-medium text-slate-500 dark:text-slate-400 text-xs">{t("admin.users.headers.actions")}</div>
                        <div className="flex flex-wrap gap-1">
                            <button className="px-2 py-1 rounded border text-xs" onClick={()=>act(r.addr, 1)} disabled={r.status!==0}>{t("admin.users.actions.approve")}</button>
                            <button className="px-2 py-1 rounded border text-xs" onClick={()=>act(r.addr, 2)} disabled={r.status!==0}>{t("admin.users.actions.reject")}</button>
                        </div>
                    </div>
                </div>
                {(r.company || r.firstName || r.lastName) ? (
                    <div className="pl-4 border-l-2 border-surface space-y-1 text-sm">
                        <div className="font-medium text-slate-500 dark:text-slate-400 text-xs">{t("admin.users.profile.heading")}</div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            {r.company ? <div><span className="text-slate-500 dark:text-slate-400">{t("admin.users.profile.company")}:</span> <span className="font-medium">{r.company}</span></div> : null}
                            {r.firstName ? <div><span className="text-slate-500 dark:text-slate-400">{t("admin.users.profile.firstName")}:</span> <span className="font-medium">{r.firstName}</span></div> : null}
                            {r.lastName ? <div><span className="text-slate-500 dark:text-slate-400">{t("admin.users.profile.lastName")}:</span> <span className="font-medium">{r.lastName}</span></div> : null}
                        </div>
                    </div>
                ) : null}
            </div>
            ))}
        </div>
        </div>
    );
}
