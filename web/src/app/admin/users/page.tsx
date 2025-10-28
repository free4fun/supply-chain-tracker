"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
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

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [users, lastReqIdx] = await Promise.all([listUsers(), lastRoleRequestByUser()]);
            const merged: Row[] = users.map(u => {
                const req = lastReqIdx[u.addr.toLowerCase()];
                return { ...u, lastRole: req?.role, lastAt: req?.timestamp };
            });
            setRows(merged.sort((a,b) => (b.lastAt||0)-(a.lastAt||0)));
        } catch (e: unknown) {
            const msg = (e as { message?: string })?.message || t("admin.users.loadFailed");
            push("error", msg);
        } finally {
            setLoading(false);
        }
    }, [push, t]);

    useEffect(() => { 
        if (!account) return;
        load(); 
    }, [account, load]);

    if (mustConnect)
        return (
    <div className="space-y-3 rounded-3xl border border-surface bg-surface-2 p-6 shadow-inner">
            <p className="text-sm text-slate-600 dark:text-slate-300">{t("admin.users.connectPrompt")}</p>
            <div className="flex gap-2">
            <button onClick={reconnect} className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-110 btn-primary focus-outline-accent">{t("admin.users.connectButton")}</button>
            <button onClick={switchAcc} className="rounded-full border border-slate-300/70 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-accent focus-outline-accent dark:border-slate-700 dark:text-slate-200">{t("admin.users.switchButton")}</button>
            </div>
        </div>
        );

    if (!isAdmin)
        return (
    <div className="space-y-3 rounded-3xl border border-surface bg-surface-2 p-6 shadow-inner">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t("admin.users.title")}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">{t("admin.users.onlyAdmin")}</p>
            <button onClick={switchAcc} className="rounded-full border border-slate-300/70 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-accent focus-outline-accent dark:border-slate-700 dark:text-slate-200">{t("admin.users.switchAdmin")}</button>
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
    <div className="space-y-4 rounded-3xl border border-surface bg-surface-2 p-6 shadow-inner">
        <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t("admin.users.title")}</h1>
            <div className="flex items-center gap-3">
            <label className="text-sm flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={onlyPending} onChange={e=>setOnlyPending(e.target.checked)} /> {t("admin.users.onlyPending")}
            </label>
            <button 
                onClick={load} 
                disabled={loading} 
                className="rounded-full border border-slate-300/70 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-accent hover:text-accent disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
            >
                {loading ? t("admin.users.loading") : t("admin.users.refresh")}
            </button>
            </div>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-700 border-t border-b border-slate-200 dark:border-slate-700">
            {data.length===0 && <p className="text-sm p-4 text-slate-500 dark:text-slate-400">{t("admin.users.empty")}</p>}
            {data.map(r => (
            <div key={r.id} className="p-4 space-y-3">
                <div className="grid grid-cols-12 gap-3 items-start text-sm">
                    <div className="col-span-4 space-y-1">
                        <div className="font-medium text-slate-500 dark:text-slate-400 text-xs">{t("admin.users.headers.address")}</div>
                        <div className="break-all font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{r.addr}</div>
                    </div>
                    <div className="col-span-2 space-y-1">
                        <div className="font-medium text-slate-500 dark:text-slate-400 text-xs">{t("admin.users.headers.role")}</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{r.role ? (t(`roles.${r.role}`) !== `roles.${r.role}` ? t(`roles.${r.role}`) : r.role) : "-"}</div>
                        {r.pendingRole && r.pendingRole !== r.role ? (
                            <div className="text-xs text-amber-600 dark:text-amber-400">
                                {t("admin.users.pendingRole")}: {(t(`roles.${r.pendingRole}`) !== `roles.${r.pendingRole}`) ? t(`roles.${r.pendingRole}`) : r.pendingRole}
                            </div>
                        ) : null}
                    </div>
                    <div className="col-span-2 space-y-1">
                        <div className="font-medium text-slate-500 dark:text-slate-400 text-xs">{t("admin.users.headers.status")}</div>
                        <div className={`font-semibold ${r.status===0?"text-amber-700 dark:text-amber-400":r.status===1?"text-emerald-700 dark:text-emerald-400":r.status===2?"text-rose-700 dark:text-rose-400":"text-slate-600 dark:text-slate-400"}`}>
                            {t(`admin.users.status.${STATUS_KEYS[r.status as 0|1|2|3]}`)}
                        </div>
                    </div>
                    <div className="col-span-2 space-y-1">
                        <div className="font-medium text-slate-500 dark:text-slate-400 text-xs">{t("admin.users.headers.lastRequest")}</div>
                        {r.lastRole ? (
                            <>
                            <div className="font-semibold text-slate-800 dark:text-slate-100">{(t(`roles.${r.lastRole}`) !== `roles.${r.lastRole}`) ? t(`roles.${r.lastRole}`) : r.lastRole}</div>
                            {r.lastAt ? <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(r.lastAt*1000).toLocaleString()}</div> : null}
                            </>
                        ) : <span className="text-slate-400">-</span>}
                    </div>
                    <div className="col-span-2 space-y-1">
                        <div className="font-medium text-slate-500 dark:text-slate-400 text-xs">{t("admin.users.headers.actions")}</div>
                        <div className="flex flex-wrap gap-1">
                            <button 
                                className="rounded-full border border-slate-300/70 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200" 
                                onClick={()=>act(r.addr, 1)} 
                                disabled={r.status!==0}
                            >
                                {t("admin.users.actions.approve")}
                            </button>
                            <button 
                                className="rounded-full border border-slate-300/70 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-rose-500 hover:text-rose-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200" 
                                onClick={()=>act(r.addr, 2)} 
                                disabled={r.status!==0}
                            >
                                {t("admin.users.actions.reject")}
                            </button>
                        </div>
                    </div>
                </div>
                {(r.company || r.firstName || r.lastName) ? (
                    <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-1 text-sm">
                        <div className="font-medium text-slate-500 dark:text-slate-400 text-xs">{t("admin.users.profile.heading")}</div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            {r.company ? <div><span className="text-slate-500 dark:text-slate-400">{t("admin.users.profile.company")}:</span> <span className="font-medium text-slate-700 dark:text-slate-200">{r.company}</span></div> : null}
                            {r.firstName ? <div><span className="text-slate-500 dark:text-slate-400">{t("admin.users.profile.firstName")}:</span> <span className="font-medium text-slate-700 dark:text-slate-200">{r.firstName}</span></div> : null}
                            {r.lastName ? <div><span className="text-slate-500 dark:text-slate-400">{t("admin.users.profile.lastName")}:</span> <span className="font-medium text-slate-700 dark:text-slate-200">{r.lastName}</span></div> : null}
                        </div>
                    </div>
                ) : null}
            </div>
            ))}
        </div>
        </div>
    );
}
