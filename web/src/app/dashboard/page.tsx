// web/src/app/dashboard/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useWeb3 } from "@/contexts/Web3Context";
import { getUserTokens, getTokenBalance } from "@/lib/sc";

export default function Dashboard() {
  const { account, mustConnect, error } = useWeb3();
  const [tokens, setTokens] = useState<number[]>([]);
  const [balances, setBalances] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!account || mustConnect) return;
    (async () => {
      try {
        const ids: bigint[] = await getUserTokens(account);
        const nums = ids.map(Number);
        setTokens(nums);
        const balPairs = await Promise.all(nums.map(async (id) => {
          const bal = await getTokenBalance(id, account);
          return [id, bal.toString()] as const;
        }));
        setBalances(Object.fromEntries(balPairs));
      } catch (e) { console.error(e); }
    })();
  }, [account, mustConnect]);

  if (mustConnect) return <p>Conectá la wallet.</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="p-6">
      <h2 className="font-bold">Mis tokens</h2>
      <ul className="list-disc ml-6">
        {tokens.map(id => (
          <li key={id}>#{id} — balance: {balances[id] ?? "…"}</li>
        ))}
      </ul>
    </div>
  );
}
