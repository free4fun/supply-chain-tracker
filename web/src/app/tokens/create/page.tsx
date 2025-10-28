// web/src/app/tokens/create/page.tsx
"use client";
import { useState } from "react";
import { createToken } from "@/lib/sc";
import { useToast } from "@/contexts/ToastContext";
import { z } from "zod";
import { useWeb3 } from "@/contexts/Web3Context";

const schema = z.object({
  name: z.string().trim().min(1, "Name required"),
  supply: z.coerce.bigint().refine(v => v > 0n, "Supply must be > 0"),
  features: z.string().trim().refine(s => {
    try { if (!s) return true; JSON.parse(s); return true; } catch { return false; }
  }, "Features must be valid JSON"),
  parentId: z.coerce.bigint().nonnegative(),
});

export default function CreateTokenPage() {
  const [name, setName] = useState("");
  const [supply, setSupply] = useState("0");
  const [features, setFeatures] = useState("{}");
  const [parentId, setParentId] = useState("0");
  const [pending, setPending] = useState(false);
  const { push } = useToast();
  const { account } = useWeb3();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const parsed = schema.safeParse({ name, supply, features, parentId });
    if (!parsed.success) { push("error", parsed.error.issues[0].message); return; }
    try {
      setPending(true);
      await createToken(
        parsed.data.name,
        parsed.data.supply,
        parsed.data.features || "{}",      // ✅ usa el validado
        parsed.data.parentId
      );
      push("success","Token created");
      setName(""); setSupply("0"); setParentId("0"); // dejamos features como está
    } catch (e:any) {
      push("error", e?.message || "Transaction failed");
    } finally { setPending(false); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Create token</h1>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
        <label className="text-sm">Name
          <input className="border w-full px-2 py-1 rounded"
                 value={name} onChange={e=>setName(e.target.value)} />
        </label>
        <label className="text-sm">Total supply
          <input className="border w-full px-2 py-1 rounded"
                 type="number" inputMode="numeric" step={1} min={1}
                 value={supply} onChange={e=>setSupply(e.target.value)} />
        </label>
        <label className="text-sm col-span-full">Features (JSON)
          <textarea className="border w-full px-2 py-1 rounded" rows={4}
                    value={features} onChange={e=>setFeatures(e.target.value)} />
        </label>
        <label className="text-sm">Parent ID
          <input className="border w-full px-2 py-1 rounded"
                 type="number" inputMode="numeric" step={1} min={0}
                 value={parentId} onChange={e=>setParentId(e.target.value)} />
        </label>
        <div className="col-span-full">
          <button
            disabled={!account || pending}
            className="px-3 py-1 rounded bg-black text-white disabled:opacity-60">
            {pending ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
