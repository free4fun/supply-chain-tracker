// web/src/app/tokens/create/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { useToast } from "@/contexts/ToastContext";
import { useWeb3 } from "@/contexts/Web3Context";
import { useRole } from "@/contexts/RoleContext";
import { createToken, getSuggestedParent } from "@/lib/sc";
import { useI18n } from "@/contexts/I18nContext";

export default function CreateTokenPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [supply, setSupply] = useState("0");
  const [features, setFeatures] = useState("{}");
  const [suggestedParent, setSuggestedParent] = useState<bigint>(0n);
  const [pending, setPending] = useState(false);
  const { push } = useToast();
  const { account } = useWeb3();
  const { activeRole, isApproved, loading: roleLoading, isAdmin, statusLabel } = useRole();
  const { t } = useI18n();

  const canCreate = Boolean((activeRole && ["Producer", "Factory"].includes(activeRole)) || isAdmin);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("tokens.create.errors.name")),
        description: z.string().trim(),
        supply: z.coerce.bigint().refine(v => v > 0n, t("tokens.create.errors.supply")),
        features: z
          .string()
          .trim()
          .refine(value => {
            if (!value) return true;
            try {
              JSON.parse(value);
              return true;
            } catch {
              return false;
            }
          }, t("tokens.create.errors.metadata")),
      }),
    [t]
  );

  useEffect(() => {
    if (!account) {
      setSuggestedParent(0n);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await getSuggestedParent(account);
        if (!cancelled) setSuggestedParent(BigInt(raw));
      } catch (err) {
        console.error(err);
        if (!cancelled) setSuggestedParent(0n);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account, activeRole]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const parsed = schema.safeParse({ name, description, supply, features });
    if (!parsed.success) {
      push("error", parsed.error.issues[0].message);
      return;
    }
    try {
      setPending(true);
      await createToken(
        parsed.data.name,
        parsed.data.description,
        parsed.data.supply,
        parsed.data.features || "{}"
      );
      push("success", t("tokens.create.success"));
      setName("");
      setDescription("");
      setSupply("0");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("tokens.create.failed");
      push("error", message);
    } finally { setPending(false); }
  }

  if (!roleLoading && !isApproved && !isAdmin) {
    return (
      <div className="rounded-3xl border border-amber-300/60 bg-amber-50/70 p-6 text-sm text-amber-900 shadow-sm dark:border-amber-300/40 dark:bg-amber-500/10 dark:text-amber-100">
        <p className="font-semibold">{t("tokens.create.notApprovedTitle")}</p>
        <p>{t("tokens.create.notApprovedBody", { status: statusLabel ?? t("common.status.none") })}</p>
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 text-sm text-slate-600 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/80 dark:text-slate-300">
        {t("tokens.create.roleRestriction")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("tokens.create.title")}</h1>
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-2 max-w-3xl">
        <label className="text-sm">{t("tokens.create.name")}
          <input className="border w-full px-2 py-1 rounded"
                 value={name} onChange={e=>setName(e.target.value)} />
        </label>
        <label className="text-sm">{t("tokens.create.description")}
          <textarea className="border w-full px-2 py-1 rounded" rows={3}
                    value={description} onChange={e=>setDescription(e.target.value)} />
        </label>
        <label className="text-sm">{t("tokens.create.supply")}
          <input className="border w-full px-2 py-1 rounded"
                 type="number" inputMode="numeric" step={1} min={1}
                 value={supply} onChange={e=>setSupply(e.target.value)} />
        </label>
        <label className="text-sm col-span-full">{t("tokens.create.metadata")}
          <textarea className="border w-full px-2 py-1 rounded" rows={4}
                    value={features} onChange={e=>setFeatures(e.target.value)} />
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400 md:col-span-2">
          {t("tokens.create.parentInfo", { parent: suggestedParent.toString() })}
        </p>
        {suggestedParent === 0n && activeRole && activeRole !== "Producer" ? (
          <p className="text-xs text-amber-600 dark:text-amber-300 md:col-span-2">
            {t("tokens.create.parentWarning")}
          </p>
        ) : null}
        <div className="col-span-full">
          <button
            disabled={!account || pending}
            className="px-3 py-1 rounded bg-black text-white disabled:opacity-60">
            {pending ? t("tokens.create.creating") : t("tokens.create.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
