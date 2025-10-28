"use client";
import { useEffect, useState } from "react";
import { useWeb3 } from "@/contexts/Web3Context";
import { transfer, acceptTransfer, rejectTransfer, getUserTransfers, getTransfer } from "@/lib/sc";
import { isAddress } from "ethers";
import { useToast } from "@/contexts/ToastContext";
import { z } from "zod";

type TRow = { id:number; from:string; to:string; tokenId:number; amount:number; status:number };

const schema = z.object({
  to: z.string().refine(isAddress, "Invalid recipient"),
  tokenId: z.coerce.number().int().min(1, "Token ID must be >= 1"),
  amount: z.coerce.bigint().refine(v => v > 0n, "Amount must be > 0"),
});


export default function TransfersPage() {
  const { account } = useWeb3();
  const { push } = useToast();

  const [to, setTo] = useState("");
  const [tokenId, setTokenId] = useState("1");
  const [amount, setAmount] = useState("0");
  const [pending, setPending] = useState(false);

  const [incoming, setIncoming] = useState<TRow[]>([]);
  const [outgoing, setOutgoing] = useState<TRow[]>([]);

  const disabled = !account || pending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ to, tokenId, amount });
    if (!parsed.success) { push("error", parsed.error.issues[0].message); return; }
    try {
      setPending(true);
      await transfer(parsed.data.to, BigInt(parsed.data.tokenId), parsed.data.amount);
      push("success","Transfer created");
      await refresh();
    } catch (e:any) {
      push("error", e?.message || "Transaction failed");
    } finally { setPending(false); }
  }

  async function refresh() {
    if (!account) { setIncoming([]); setOutgoing([]); return; }
    const ids: bigint[] = await getUserTransfers(account);
    const inc: TRow[] = [], out: TRow[] = [];
    for (const id of ids) {
      try {
        const t = await getTransfer(Number(id));
        const row: TRow = { id:Number(t[0]), from:t[1], to:t[2], tokenId:Number(t[3]), amount:Number(t[5]), status:Number(t[6]) };
        if (row.to.toLowerCase() === account.toLowerCase()) inc.push(row);
        if (row.from.toLowerCase() === account.toLowerCase()) out.push(row);
      } catch {}
    }
    const byStatus = (a:TRow,b:TRow)=>a.status-b.status || a.id-b.id;
    setIncoming(inc.sort(byStatus));
    setOutgoing(out.sort(byStatus));
  }

  useEffect(() => { refresh(); }, [account]);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">New transfer</h1>
        <form onSubmit={submit} className="grid md:grid-cols-4 gap-3">
          <input className="border px-2 py-1 rounded md:col-span-2" placeholder="Recipient 0x..." value={to} onChange={e=>setTo(e.target.value)} />
          <input className="border px-2 py-1 rounded" placeholder="Token ID" value={tokenId} onChange={e=>setTokenId(e.target.value)} />
          <input className="border px-2 py-1 rounded" placeholder="Amount" value={amount} onChange={e=>setAmount(e.target.value)} />
          <div className="md:col-span-4">
            <button disabled={disabled} className="px-3 py-1 rounded bg-black text-white disabled:opacity-60">
                {pending ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Incoming</h2>
        <div className="grid gap-2">
          {incoming.length === 0 && <p className="text-sm">No incoming transfers.</p>}
          {incoming.map(r => (
            <div key={r.id} className="border rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">#{r.id} · Token {r.tokenId} · Amount {r.amount}</div>
                <div className="text-xs text-gray-600">From {r.from}</div>
                <div className="text-xs">Status: {["Pending","Accepted","Rejected"][r.status]}</div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded border"
                        onClick={async()=>{ try{ await acceptTransfer(BigInt(r.id)); push("success","Accepted"); await refresh(); } catch(e:any){ push("error", e?.message||"Failed"); } }}
                        disabled={r.status!==0 || !account}>Accept</button>
                <button className="px-3 py-1 rounded border"
                        onClick={async()=>{ try{ await rejectTransfer(BigInt(r.id)); push("success","Rejected"); await refresh(); } catch(e:any){ push("error", e?.message||"Failed"); } }}
                        disabled={r.status!==0 || !account}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Outgoing</h2>
        <div className="grid gap-2">
          {outgoing.length === 0 && <p className="text-sm">No outgoing transfers.</p>}
          {outgoing.map(r => (
            <div key={r.id} className="border rounded p-3">
              <div className="font-medium">#{r.id} · Token {r.tokenId} · Amount {r.amount}</div>
              <div className="text-xs text-gray-600">To {r.to}</div>
              <div className="text-xs">Status: {["Pending","Accepted","Rejected"][r.status]}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
