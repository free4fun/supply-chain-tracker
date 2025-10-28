"use client";
import { useEffect, useMemo, useState } from "react";
import { changeStatusUser, scAdmin } from "@/lib/sc";
import { isAddress } from "ethers";
import { useWeb3 } from "@/contexts/Web3Context";
import { useToast } from "@/contexts/ToastContext";

const ADMIN_ENV = (process.env.NEXT_PUBLIC_ADMIN_ADDRESS || "").toLowerCase();

export default function AdminPage() {
  const { account, mustConnect, reconnect, switchAcc } = useWeb3();
  const { push } = useToast();

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
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="text-sm">Cuenta actual: {account}</p>
        <p className="text-sm">Sólo el admin puede cambiar estados.</p>
        <button onClick={switchAcc} className="px-3 py-1 rounded border">Cambiar a cuenta admin</button>
        <p className="text-xs text-gray-500 mt-2">Admin env: {process.env.NEXT_PUBLIC_ADMIN_ADDRESS}</p>
        <p className="text-xs text-gray-500">Admin on-chain: {onchainAdmin}</p>
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAddress(addr)) return push("error","Dirección inválida");
    try {
      setPending(true);
      await changeStatusUser(addr, status);
      push("success","Estado actualizado");
    } catch (e:any) { push("error", e?.message || "Falló la transacción"); }
    finally { setPending(false); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Admin</h1>
      <p className="text-sm">Admin env: {process.env.NEXT_PUBLIC_ADMIN_ADDRESS}</p>
      <p className="text-sm">Admin on-chain: {onchainAdmin}</p>

      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input className="border px-2 py-1 rounded min-w-[22rem]" placeholder="0x..." value={addr} onChange={e=>setAddr(e.target.value)} />
        <select className="border px-2 py-1 rounded" value={status} onChange={e=>setStatus(+e.target.value)}>
          <option value={0}>Pending</option><option value={1}>Approved</option>
          <option value={2}>Rejected</option><option value={3}>Canceled</option>
        </select>
        <button disabled={pending} className="px-3 py-1 rounded bg-black text-white disabled:opacity-60">
          {pending?"Actualizando…":"Actualizar"}
        </button>
      </form>
    </div>
  );
}
