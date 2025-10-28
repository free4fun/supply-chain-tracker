"use client";
import { useEffect, useState } from "react";
import { requestUserRole, getUserInfo } from "@/lib/sc";
import { useToast } from "@/contexts/ToastContext";
import { z } from "zod";
import { useWeb3 } from "@/contexts/Web3Context";

const ROLES = ["Producer","Factory","Retailer","Consumer"] as const;
const schema = z.object({ role: z.enum(ROLES) });
const STATUS = ["Pending","Approved","Rejected","Canceled"] as const;

export default function ProfilePage() {
  const [role, setRole] = useState<(typeof ROLES)[number]>("Producer");
  const [pending, setPending] = useState(false);
  const [info, setInfo] = useState<{ role?: string; status?: number } | null>(null);

  const { push } = useToast();
  // Expecting these from Web3Context; if not present, only `account` is used.
  const { account, mustConnect, reconnect, switchAcc } = useWeb3() as any;

  // Load current on-chain user info for connected account
  async function load() {
    if (!account) { setInfo(null); return; }
    try {
      const u = await getUserInfo(account);
      setInfo({ role: u[2], status: Number(u[3]) });
    } catch {
      // Not registered yet
      setInfo(null);
    }
  }

  useEffect(() => { load(); }, [account]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ role });
    if (!parsed.success) { push("error","Invalid role"); return; }
    if (!account) { push("error","Connect wallet first"); return; }
    try {
      setPending(true);
      await requestUserRole(parsed.data.role);
      push("success","Role request sent");
      await load(); // refresh view after tx
    } catch (e:any) {
      push("error", e?.message || "Transaction failed");
    } finally {
      setPending(false);
    }
  }

  // Wallet not connected or user rejected: guide to connect/switch
  if (mustConnect) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Profile</h1>
        <p className="text-sm">You must connect your wallet.</p>
        <div className="flex gap-2">
          <button onClick={reconnect} className="px-3 py-1 rounded bg-black text-white">Connect wallet</button>
          <button onClick={switchAcc} className="px-3 py-1 rounded border">Switch account</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Profile</h1>

      {/* Current on-chain user info */}
      {account && (
        <div className="text-sm">
          <div>Account: <b>{account}</b></div>
          {info ? (
            <>
              <div>Current role: <b>{info.role}</b></div>
              <div>Status: <b>{STATUS[info.status ?? 0]}</b></div>
            </>
          ) : (
            <div>No user record yet.</div>
          )}
        </div>
      )}

      {/* Request role form */}
      <form onSubmit={submit} className="flex items-center gap-2">
        <label className="text-sm">Role</label>
        <select
          className="border px-2 py-1 rounded"
          value={role}
          onChange={e=>setRole(e.target.value as any)}
        >
          {ROLES.map(r => <option key={r}>{r}</option>)}
        </select>
        <button
          disabled={!account || pending}
          className="px-3 py-1 rounded bg-black text-white disabled:opacity-60"
        >
          {pending ? "Sending..." : "Request role"}
        </button>
      </form>
    </div>
  );
}
