// web/src/app/tokens/create/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/contexts/ToastContext";
import { useWeb3 } from "@/contexts/Web3Context";
import { useRole } from "@/contexts/RoleContext";
import {
  ComponentInput,
  createToken,
  getSuggestedParent,
  getTokenBalance,
  getTokenView,
  getUserTokens,
} from "@/lib/sc";
import { useI18n } from "@/contexts/I18nContext";

const JSON_SPACING = 2;

type FieldConfig = {
  key: string;
  label: string;
  placeholder?: string;
  helper?: string;
  type?: "text" | "number" | "date";
};

type RoleConfig = {
  label: string;
  title: string;
  description: string;
  gradient: string;
  background: string;
  accentBorder: string;
  accentMuted: string;
  icon: string;
  requiresComponents: boolean;
  componentLabel: string;
  emptyInventory: string;
  defaults: Record<string, string>;
  fields: FieldConfig[];
};

type IngredientRow = { tokenId: number | null; amount: string };

type InventoryToken = {
  id: number;
  name: string;
  description: string;
  balance: bigint;
  availableSupply: bigint;
  features: string;
  metadata: Record<string, unknown> | null;
};

const ROLE_CONFIG: Record<string, RoleConfig> = {
  Producer: {
    label: "Viticultor",
    title: "Cosecha de uvas",
    description:
      "Define cada lote de uvas con los detalles clave del viñedo y la cosecha. Estos datos serán la base de toda la trazabilidad.",
    gradient: "from-emerald-500 to-lime-500",
    background: "bg-emerald-50",
    accentBorder: "border-emerald-200",
    accentMuted: "bg-emerald-100/80",
    icon: "🍇",
    requiresComponents: false,
    componentLabel: "Lotes disponibles",
    emptyInventory: "Creá tu primer lote de uvas para comenzar la trazabilidad.",
    defaults: {
      grapeVariety: "Malbec",
      harvestDate: "",
      parcel: "Cuadro 5",
      weightKg: "1000",
      vineyardAltitude: "980",
      soil: "Franco arenoso",
    },
    fields: [
      { key: "grapeVariety", label: "Variedad de uva", placeholder: "Malbec, Cabernet, Torrontés…" },
      { key: "harvestDate", label: "Fecha de cosecha", type: "date" },
      { key: "parcel", label: "Cuadro o parcela", placeholder: "Cuadro 5 - Norte" },
      { key: "weightKg", label: "Peso total (kg)", type: "number", helper: "Peso exacto recibido en bodega." },
      { key: "vineyardAltitude", label: "Altitud del viñedo (msnm)", type: "number" },
      { key: "soil", label: "Tipo de suelo", placeholder: "Aluvional, calcáreo…" },
    ],
  },
  Factory: {
    label: "Bodega",
    title: "Vinificación",
    description:
      "Transformá los lotes de uvas recibidos en vino detallando el proceso enológico. El sistema consumirá automáticamente las materias primas utilizadas.",
    gradient: "from-rose-600 to-purple-600",
    background: "bg-rose-50",
    accentBorder: "border-rose-200",
    accentMuted: "bg-rose-100/80",
    icon: "🍷",
    requiresComponents: true,
    componentLabel: "Uvas disponibles",
    emptyInventory: "Todavía no recibiste uvas aprobadas. Aceptá una transferencia para poder vinificar.",
    defaults: {
      wineName: "Malbec Reserva",
      vintage: "2024",
      alcohol: "13.5",
      fermentation: "Acero inoxidable 18 días",
      agingMonths: "10",
      tastingNotes: "Violeta profundo, taninos sedosos",
    },
    fields: [
      { key: "wineName", label: "Nombre del vino", placeholder: "Malbec Reserva" },
      { key: "vintage", label: "Año de cosecha", type: "number" },
      { key: "alcohol", label: "% de alcohol", type: "number" },
      { key: "fermentation", label: "Fermentación", placeholder: "Acero inoxidable, levaduras nativas" },
      { key: "agingMonths", label: "Meses de crianza", type: "number" },
      { key: "tastingNotes", label: "Notas de cata", placeholder: "Frutos rojos, especias suaves" },
    ],
  },
  Retailer: {
    label: "Distribuidor",
    title: "Curaduría de packs",
    description:
      "Combiná distintos vinos en presentaciones especiales. Cada botella usada se descuenta para garantizar que no se reutilicen.",
    gradient: "from-amber-500 to-orange-500",
    background: "bg-amber-50",
    accentBorder: "border-amber-200",
    accentMuted: "bg-amber-100/70",
    icon: "📦",
    requiresComponents: true,
    componentLabel: "Vinos disponibles",
    emptyInventory: "Recibí vinos de una bodega para poder armar packs o ediciones especiales.",
    defaults: {
      packName: "Selección Andina",
      packagingDate: "",
      bottleCount: "3",
      pairing: "Carnes a la parrilla, pastas con salsas intensas",
      market: "Mercado interno",
      shelfLifeMonths: "24",
    },
    fields: [
      { key: "packName", label: "Nombre del pack", placeholder: "Selección Andina" },
      { key: "packagingDate", label: "Fecha de armado", type: "date" },
      { key: "bottleCount", label: "Cantidad de botellas", type: "number" },
      { key: "pairing", label: "Maridajes sugeridos", placeholder: "Carnes, quesos maduros…" },
      { key: "market", label: "Mercado destino", placeholder: "Exportación, mercado interno" },
      { key: "shelfLifeMonths", label: "Meses de vida útil", type: "number" },
    ],
  },
};

function asMetadataObject(role: string | undefined, form: Record<string, string>, identity: Record<string, string>) {
  const cfg = (role && ROLE_CONFIG[role]) || undefined;
  const base: Record<string, unknown> = { ...identity };
  if (!cfg) return base;
  for (const field of cfg.fields) {
    const raw = form[field.key] ?? "";
    if (field.type === "number") {
      base[field.key] = raw ? Number(raw) : 0;
    } else {
      base[field.key] = raw;
    }
  }
  return base;
}

function formatBigInt(value: bigint): string {
  return value.toLocaleString("es-AR");
}

function parseMetadata(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function CreateTokenPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [supply, setSupply] = useState("0");
  const [metadataMode, setMetadataMode] = useState<"form" | "json">("form");
  const [formMetadata, setFormMetadata] = useState<Record<string, string>>(ROLE_CONFIG.Producer.defaults);
  const [rawMetadata, setRawMetadata] = useState("{}");
  const [inventory, setInventory] = useState<InventoryToken[]>([]);
  const [inputs, setInputs] = useState<IngredientRow[]>([]);
  const [suggestedParent, setSuggestedParent] = useState<bigint>(0n);
  const [pending, setPending] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const { push } = useToast();
  const { account } = useWeb3();
  const { t } = useI18n();
  const { activeRole, isApproved, loading: roleLoading, isAdmin, statusLabel, company, firstName, lastName } = useRole();

  const roleKey = activeRole ?? (isAdmin ? "Producer" : undefined);
  const config = roleKey ? ROLE_CONFIG[roleKey] : undefined;
  const canCreate = Boolean(roleKey && (config || isAdmin));
  const identity = useMemo(
    () => ({
      company: company ?? "",
      contact: [firstName, lastName].filter(Boolean).join(" "),
      role: roleKey ? ROLE_CONFIG[roleKey]?.label ?? roleKey : roleKey ?? "",
    }),
    [company, firstName, lastName, roleKey]
  );

  const metadataPreview = useMemo(() => {
    if (metadataMode === "json") {
      return rawMetadata || "{}";
    }
    return JSON.stringify(asMetadataObject(roleKey, formMetadata, identity), null, JSON_SPACING);
  }, [metadataMode, rawMetadata, formMetadata, identity, roleKey]);

  const availableInventory = useMemo(
    () => inventory.filter(item => item.balance > 0n),
    [inventory]
  );

  useEffect(() => {
    if (!config) return;
    setFormMetadata(config.defaults);
    setMetadataMode("form");
    setRawMetadata(JSON.stringify({ ...config.defaults, ...identity }, null, JSON_SPACING));
    setInputs(config.requiresComponents ? [{ tokenId: null, amount: "" }] : []);
  }, [config, identity]);

  useEffect(() => {
    if (!account) {
      setInventory([]);
      return;
    }
    let cancelled = false;
    setInventoryLoading(true);
    const load = async () => {
      try {
        const tokenIds = await getUserTokens(account);
        const rows: InventoryToken[] = [];
        for (const rawId of tokenIds) {
          const id = Number(rawId);
          try {
            const [view, balance] = await Promise.all([
              getTokenView(id),
              getTokenBalance(id, account),
            ]);
            const bal = BigInt(balance);
            const features = String(view[5]);
            const available = BigInt(view[8] ?? view[7] ?? 0n);
            const metadata = parseMetadata(features);
            rows.push({
              id,
              name: String(view[2]),
              description: String(view[3] ?? ""),
              balance: bal,
              availableSupply: available,
              features,
              metadata,
            });
          } catch (err) {
            console.error(err);
          }
        }
        if (!cancelled) {
          setInventory(rows);
        }
      } finally {
        if (!cancelled) setInventoryLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [account, config?.requiresComponents]);

  useEffect(() => {
    if (!account) {
      setSuggestedParent(0n);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const raw = await getSuggestedParent(account);
        if (!cancel) setSuggestedParent(BigInt(raw));
      } catch (err) {
        console.error(err);
        if (!cancel) setSuggestedParent(0n);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [account]);

  const updateInputRow = useCallback((index: number, patch: Partial<IngredientRow>) => {
    setInputs(current => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }, []);

  const addRow = useCallback(() => {
    setInputs(current => [...current, { tokenId: null, amount: "" }]);
  }, []);

  const removeRow = useCallback((index: number) => {
    setInputs(current => (current.length <= 1 ? current : current.filter((_, i) => i !== index)));
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) return;
      if (!canCreate || !account || !config) return;

      if (!name.trim()) {
        push("error", "Ingresá un nombre para el activo");
        return;
      }
      let totalSupply: bigint;
      try {
        totalSupply = BigInt(supply);
      } catch {
        push("error", "La cantidad total debe ser un número entero");
        return;
      }
      if (totalSupply <= 0n) {
        push("error", "La cantidad total debe ser mayor a cero");
        return;
      }

      const components: ComponentInput[] = [];
      if (config.requiresComponents) {
        for (const row of inputs) {
          if (!row.tokenId || !row.amount.trim()) continue;
          const selected = availableInventory.find(token => token.id === row.tokenId);
          if (!selected) {
            push("error", "Seleccioná un lote válido para cada fila");
            return;
          }
          let amount: bigint;
          try {
            amount = BigInt(row.amount);
          } catch {
            push("error", `La cantidad para el token #${row.tokenId} debe ser un entero`);
            return;
          }
          if (amount <= 0n) {
            push("error", "Las cantidades utilizadas deben ser mayores a cero");
            return;
          }
          if (amount > selected.balance) {
            push("error", `Solo tenés ${selected.balance.toString()} unidades disponibles del token #${row.tokenId}`);
            return;
          }
          components.push({ tokenId: BigInt(row.tokenId), amount });
        }
        if (components.length === 0) {
          push("error", "Indicá qué tokens vas a transformar y en qué cantidades");
          return;
        }
      }

      const metadataPayload = metadataMode === "json"
        ? (rawMetadata.trim() ? rawMetadata.trim() : "{}")
        : JSON.stringify(asMetadataObject(roleKey, formMetadata, identity), null, JSON_SPACING);

      try {
        JSON.parse(metadataPayload || "{}");
      } catch {
        push("error", "El JSON de características no es válido");
        return;
      }

      try {
        setPending(true);
        await createToken(name.trim(), description.trim(), totalSupply, metadataPayload || "{}", components);
        push("success", "Token creado y trazabilidad actualizada");
        setName("");
        setDescription("");
        setSupply("0");
        if (config.requiresComponents) {
          setInputs([{ tokenId: null, amount: "" }]);
        }
        setRawMetadata(metadataPayload);
      } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : "No se pudo crear el token";
        push("error", message);
      } finally {
        setPending(false);
        // Refresh inventory after creation to reflect consumed balances
        if (account) {
          setInventoryLoading(true);
          getUserTokens(account)
            .then(async tokenIds => {
              const refreshed: InventoryToken[] = [];
              for (const rawId of tokenIds) {
                const id = Number(rawId);
                try {
                  const [view, balance] = await Promise.all([
                    getTokenView(id),
                    getTokenBalance(id, account),
                  ]);
                  const bal = BigInt(balance);
                  const features = String(view[5]);
                  refreshed.push({
                    id,
                    name: String(view[2]),
                    description: String(view[3] ?? ""),
                    balance: bal,
                    availableSupply: BigInt(view[8] ?? view[7] ?? 0n),
                    features,
                    metadata: parseMetadata(features),
                  });
                } catch {}
              }
              setInventory(refreshed);
            })
            .finally(() => setInventoryLoading(false));
        }
      }
    },
    [pending, canCreate, account, config, name, supply, inputs, availableInventory, metadataMode, rawMetadata, roleKey, formMetadata, identity, description, push]
  );

  if (!roleLoading && !isApproved && !isAdmin) {
    return (
      <div className="rounded-3xl border border-amber-300/60 bg-amber-50/80 p-6 text-sm text-amber-900 shadow-sm">
        <p className="font-semibold">{t("tokens.create.notApprovedTitle")}</p>
        <p>{t("tokens.create.notApprovedBody", { status: statusLabel ?? t("common.status.none") })}</p>
      </div>
    );
  }

  if (!canCreate || !config) {
    return (
      <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 text-sm text-slate-600 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/80 dark:text-slate-300">
        Solo los roles productivos (Viticultor, Bodega y Distribuidor) pueden crear nuevos tokens.
      </div>
    );
  }

  return (
    <div className={`space-y-6 rounded-[28px] border ${config.accentBorder} ${config.background} p-6 shadow-xl shadow-black/5`}> 
      <header className={`rounded-3xl bg-gradient-to-r ${config.gradient} px-6 py-5 text-white shadow-lg`}> 
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] opacity-80">{config.label}</p>
            <h1 className="text-2xl font-semibold">{config.icon} {config.title}</h1>
            <p className="mt-2 max-w-3xl text-sm opacity-90">{config.description}</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-3 text-sm">
            <p className="font-semibold">Identidad registrada</p>
            <p>{identity.company || "Empresa sin registrar"}</p>
            <p>{identity.contact || "Sin contacto"}</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className={`rounded-3xl border ${config.accentBorder} bg-white/90 p-5 shadow-inner`}> 
          <h2 className="text-lg font-semibold text-slate-800">Detalles del nuevo token</h2>
          <p className="text-sm text-slate-500">Completá la información del activo que vas a registrar para mantener la trazabilidad completa.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              Nombre del activo
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                className="rounded-xl border border-slate-300/70 px-3 py-2 text-sm shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                placeholder="Ej: Lote de uvas Malbec"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              Cantidad total disponible
              <input
                value={supply}
                onChange={event => setSupply(event.target.value)}
                className="rounded-xl border border-slate-300/70 px-3 py-2 text-sm shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                type="number"
                min={0}
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-1 text-sm font-medium text-slate-600">
              Descripción
              <textarea
                value={description}
                onChange={event => setDescription(event.target.value)}
                className="rounded-2xl border border-slate-300/70 px-3 py-2 text-sm shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                rows={3}
                placeholder="Anotaciones adicionales del lote"
              />
            </label>
          </div>
        </section>

        <section className={`rounded-3xl border ${config.accentBorder} bg-white/90 p-5 shadow-inner`}> 
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Características del lote</h2>
              <p className="text-sm text-slate-500">Podés completar el formulario sugerido o pegar tu JSON personalizado.</p>
            </div>
            <button
              type="button"
              onClick={() => setMetadataMode(mode => (mode === "form" ? "json" : "form"))}
              className="rounded-full border border-slate-300/70 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-emerald-400 hover:text-emerald-600"
            >
              {metadataMode === "form" ? "Usar JSON crudo" : "Volver al formulario"}
            </button>
          </div>

          {metadataMode === "form" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {config.fields.map(field => (
                <label key={field.key} className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                  {field.label}
                  <input
                    value={formMetadata[field.key] ?? ""}
                    onChange={event =>
                      setFormMetadata(current => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                    className="rounded-xl border border-slate-300/70 px-3 py-2 text-sm shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                    placeholder={field.placeholder}
                  />
                  {field.helper ? <span className="text-xs font-normal text-slate-400">{field.helper}</span> : null}
                </label>
              ))}
            </div>
          ) : (
            <textarea
              value={rawMetadata}
              onChange={event => setRawMetadata(event.target.value)}
              className="mt-4 w-full rounded-2xl border border-slate-300/70 bg-slate-950/90 px-4 py-3 font-mono text-xs text-slate-100 shadow-inner focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              rows={10}
              spellCheck={false}
            />
          )}

          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Vista previa JSON</h3>
            <pre className="mt-2 max-h-56 overflow-auto rounded-2xl border border-slate-200 bg-slate-900/95 p-4 text-xs text-emerald-100 shadow-inner">
              {metadataPreview}
            </pre>
          </div>
        </section>

        {config.requiresComponents ? (
          <section className={`rounded-3xl border ${config.accentBorder} bg-white/90 p-5 shadow-inner space-y-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">{config.componentLabel}</h2>
                <p className="text-sm text-slate-500">Seleccioná los tokens que vas a consumir para crear este nuevo activo.</p>
              </div>
              <button
                type="button"
                onClick={addRow}
                className="rounded-full border border-slate-300/70 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-emerald-400 hover:text-emerald-600"
              >
                Agregar token
              </button>
            </div>

            {inventoryLoading ? (
              <p className="text-sm text-slate-500">Cargando inventario…</p>
            ) : availableInventory.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300/70 bg-white/60 p-4 text-sm text-slate-500">{config.emptyInventory}</p>
            ) : (
              <div className="grid gap-4">
                {inputs.map((row, index) => (
                  <div key={index} className={`grid gap-3 rounded-2xl border ${config.accentBorder} ${config.accentMuted} p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]`}>
                    <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                      Token a transformar
                      <select
                        value={row.tokenId ?? ""}
                        onChange={event => updateInputRow(index, { tokenId: event.target.value ? Number(event.target.value) : null })}
                        className="rounded-xl border border-white/70 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                      >
                        <option value="">Seleccioná un token…</option>
                        {availableInventory.map(item => (
                          <option key={item.id} value={item.id}>
                            #{item.id} · {item.name} · saldo {item.balance.toString()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                      Cantidad a consumir
                      <input
                        value={row.amount}
                        onChange={event => updateInputRow(index, { amount: event.target.value })}
                        type="number"
                        min={0}
                        className="rounded-xl border border-white/70 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="self-end rounded-full border border-white/70 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-400 hover:text-rose-500"
                    >
                      Quitar
                    </button>
                    {row.tokenId ? (
                      <div className="md:col-span-3 rounded-2xl border border-white/60 bg-white/70 p-3 text-xs text-slate-600">
                        <p className="font-semibold">Resumen del token #{row.tokenId}</p>
                        <p>Saldo disponible: {formatBigInt(availableInventory.find(item => item.id === row.tokenId)?.balance ?? 0n)}</p>
                        <p>Disponible para transformar: {formatBigInt(availableInventory.find(item => item.id === row.tokenId)?.availableSupply ?? 0n)}</p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <footer className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {config.requiresComponents ? (
              <p>
                Último token recibido sugerido: {suggestedParent === 0n ? "ninguno" : `#${suggestedParent.toString()}`}
              </p>
            ) : (
              <p>Los lotes de uvas creados serán el inicio de la trazabilidad.</p>
            )}
          </div>
          <button
            type="submit"
            disabled={pending || (config.requiresComponents && availableInventory.length === 0)}
            className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-slate-800 disabled:opacity-60"
          >
            {pending ? "Registrando…" : "Registrar token"}
          </button>
        </footer>
      </form>
    </div>
  );
}
