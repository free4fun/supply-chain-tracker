"use client";
import { useEffect, useMemo, useState } from "react";
import { changeStatusUser } from "@/lib/sc";
import { listUsers, lastRoleRequestByUser, type UserView } from "@/lib/sc";
import { useWeb3 } from "@/contexts/Web3Context";
import { useToast } from "@/contexts/ToastContext";

const ADMIN_ENV = (process.env.NEXT_PUBLIC_ADMIN_ADDRESS || "").toLowerCase();
const statusTxt = ["Pending","Approved","Rejected","Canceled"] as const;

type Row = UserView & { lastRole?: string; lastAt?: number };

export default function AdminUsersPage() {
    const { account, mustConnect, reconnect, switchAcc } = useWeb3();
    const { push } = useToast();
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
        } catch (e:any) { push("error", e?.message || "Failed to load"); }
        finally { setLoading(false); }
    }

    useEffect(() => { 
        if (!account) return;
        load(); 
    }, [account]);

    if (mustConnect)
        return (
        <div className="space-y-2">
            <p className="text-sm">Debes conectar tu billetera.</p>
            <div className="flex gap-2">
            <button onClick={reconnect} className="px-3 py-1 rounded bg-black text-white">Conectar</button>
            <button onClick={switchAcc} className="px-3 py-1 rounded border">Cambiar cuenta</button>
            </div>
        </div>
        );

    if (!isAdmin)
        return (
        <div className="space-y-2">
            <h1 className="text-xl font-semibold">Admin · Users</h1>
            <p className="text-sm">Sólo el admin puede ver y aprobar solicitudes.</p>
            <button onClick={switchAcc} className="px-3 py-1 rounded border">Cambiar a cuenta admin</button>
        </div>
        );
    const badAddr = !(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS && /^0x[0-9a-fA-F]{40}$/.test(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS));
    if (badAddr) {
        return <p className="text-sm text-red-600">Configura NEXT_PUBLIC_CONTRACT_ADDRESS y reinicia el dev server.</p>;
    }

    async function act(addr: string, s: number) {
        try {
            await changeStatusUser(addr, s);
            push("success", `Status -> ${statusTxt[s as 0|1|2|3]}`);
            await load();
        } catch (e:any) { push("error", e?.message || "Tx failed"); }
    }

    const data = rows.filter(r => (onlyPending ? r.status === 0 : true));
    return (
        <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Admin · Users</h1>
            <div className="flex items-center gap-3">
            <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={onlyPending} onChange={e=>setOnlyPending(e.target.checked)} /> Only Pending
            </label>
            <button onClick={load} disabled={loading} className="px-3 py-1 rounded border">{loading?"Loading…":"Refresh"}</button>
            </div>
        </div>

        <div className="grid grid-cols-12 gap-2 text-sm font-medium px-2">
            <div className="col-span-4">Address</div>
            <div className="col-span-2">Current role</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Last request</div>
            <div className="col-span-2">Actions</div>
        </div>
        <div className="divide-y">
            {data.length===0 && <p className="text-sm p-2">No users.</p>}
            {data.map(r => (
            <div key={r.id} className="grid grid-cols-12 gap-2 items-center p-2">
                <div className="col-span-4 break-all">{r.addr}</div>
                <div className="col-span-2">{r.role || "-"}</div>
                <div className={`col-span-2 ${r.status===0?"text-yellow-700":r.status===1?"text-green-700":r.status===2?"text-red-700":"text-gray-600"}`}>
                {statusTxt[r.status as 0|1|2|3] || r.status}
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
                <button className="px-2 py-1 rounded border" onClick={()=>act(r.addr, 1)} disabled={r.status===1}>Approve</button>
                <button className="px-2 py-1 rounded border" onClick={()=>act(r.addr, 2)} disabled={r.status===2}>Reject</button>
                <button className="px-2 py-1 rounded border" onClick={()=>act(r.addr, 3)} disabled={r.status===3}>Cancel</button>
                </div>
            </div>
            ))}
        </div>
        </div>
    );
}
