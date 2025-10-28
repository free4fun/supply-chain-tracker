"use client";
import { useEffect, useState } from "react";
import { getTokenView } from "@/lib/sc";

export default function TokensPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [maxId, setMaxId] = useState(10); // simple probe range

  useEffect(() => {
    (async () => {
      const acc: any[] = [];
      for (let i = 1; i <= maxId; i++) {
        try {
          const t = await getTokenView(i);
          acc.push({ id: Number(t[0]), name: t[2], supply: Number(t[3]), parentId: Number(t[5]) });
        } catch { /* token may not exist */ }
      }
      setRows(acc);
    })();
  }, [maxId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">Tokens</h1>
        <input
          className="border px-2 py-1 rounded w-24"
          type="number"
          value={maxId}
          onChange={e => setMaxId(Math.max(1, Number(e.target.value)))}
          title="Probe up to tokenId"
        />
      </div>
      <div className="grid gap-2">
        {rows.length === 0 && <p className="text-sm">No tokens found in range.</p>}
        {rows.map(r => (
          <div key={r.id} className="border rounded p-3">
            <div className="font-medium">#{r.id} — {r.name}</div>
            <div className="text-sm text-gray-600">Supply: {r.supply} · Parent: {r.parentId}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
