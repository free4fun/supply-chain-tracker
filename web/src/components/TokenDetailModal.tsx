"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getTokenInputs, getTokenView, getUserInfo, getUserTransfers, getTransfer } from "@/lib/sc";
import { handleBlockOutOfRange } from "@/lib/blockOutOfRange";
import { useRole } from "@/contexts/RoleContext";
import { TokenTxHash } from "@/components/TokenTxHash";
import { useRoleTheme } from "@/hooks/useRoleTheme";
import { useI18n } from "@/contexts/I18nContext";

type TokenDetailModalProps = {
  tokenId: number | null;
  onClose: () => void;
  fetchDetail: (id: number) => Promise<any>;
};

type TokenDetail = {
  id: number;
  name: string;
  description: string;
  creator: string;
  parentId: number;
  createdAt: number;
  metadata: Record<string, unknown> | null;
  features: string;
};

function formatBigInt(value: bigint, locale: string): string {
  return value.toLocaleString(locale);
}

function formatDate(timestamp: number | string | undefined, locale: string): string {
  if (!timestamp) return "—";
  // Si es string, intentar parsear (puede ser ISO o Unix timestamp string)
  let ts: number;
  if (typeof timestamp === "string") {
    // Intentar parsear como ISO primero
    const parsed = Date.parse(timestamp);
    if (!isNaN(parsed)) {
      ts = parsed;
    } else {
      // Intentar como número
      ts = Number(timestamp);
      if (isNaN(ts)) return timestamp; // Devolver como string si no se puede parsear
    }
  } else {
    ts = timestamp;
  }
  
  // Si es un timestamp en segundos (Unix), convertir a milisegundos
  if (ts < 10000000000) {
    ts = ts * 1000;
  }
  
  return new Date(ts).toLocaleString(locale, {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, c => c.toUpperCase());
}

function formatValue(value: unknown, locale: string): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  // Si parece una fecha, formatearla
  if (typeof value === "string" || typeof value === "number") {
    const str = String(value);
    // Detectar formatos de fecha comunes
    if (/^\d{4}-\d{2}-\d{2}/.test(str) || /^\d{10,13}$/.test(str)) {
      return formatDate(value as any, locale);
    }
  }
  return String(value);
}

// Campos predefinidos por tipo/rol de creador (excluir company, contact, role, firstName, lastName de metadata visible)
const KNOWN_BY_ROLE: Record<string, string[]> = {
  Producer: ["grapeVariety", "harvestDate", "parcel", "weightKg", "vineyardAltitude", "soil"],
  Factory: ["wineName", "vintage", "alcohol", "fermentation", "agingMonths", "tastingNotes"],
  Retailer: ["packName", "packagingDate", "bottleCount", "pairing", "market", "shelfLifeMonths"],
  Consumer: [],
  Admin: [],
};

// Campos que no deben mostrarse en metadata (son internos o redundantes)
const HIDDEN_METADATA = ["company", "contact", "role", "firstName", "lastName"];

export default function TokenDetailModal({ tokenId, onClose, fetchDetail }: TokenDetailModalProps) {
  const [detail, setDetail] = useState<TokenDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatorInfo, setCreatorInfo] = useState<{ role?: string; company?: string; firstName?: string; lastName?: string } | null>(null);
  const [inputs, setInputs] = useState<Array<{ tokenId: number; amount: bigint; name?: string; creator?: string; creatorCompany?: string; creatorRole?: string; createdAt?: number; acquiredAt?: number; metadata?: Record<string, unknown> }>>([]);
  const [grandInputsByParent, setGrandInputsByParent] = useState<Record<number, Array<{ tokenId: number; amount: bigint; name?: string; creator?: string; creatorCompany?: string; creatorRole?: string; createdAt?: number; acquiredAt?: number; metadata?: Record<string, unknown> }>>>({});
  const { activeRole } = useRole();
  const { theme } = useRoleTheme();
  const { t, lang } = useI18n();
  const locale = useMemo(() => (lang === "es" ? "es-AR" : "en-US"), [lang]);

  useEffect(() => {
    if (!tokenId) {
      setDetail(null);
      setCreatorInfo(null);
      setInputs([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchDetail(tokenId);
        if (cancelled) return;
        setDetail(data);
        // Info del creador (rol y empresa)
        try {
          const ui = await getUserInfo(data.creator);
          if (!cancelled) setCreatorInfo({ role: String(ui[2] ?? ""), company: String(ui[5] ?? ""), firstName: String(ui[6] ?? ""), lastName: String(ui[7] ?? "") });
        } catch (e) {
          handleBlockOutOfRange(e);
        }
        // Cargar inputs inmediatos
        try {
          const comps = await getTokenInputs(tokenId);
          const enriched: Array<{ tokenId: number; amount: bigint; name?: string; creator?: string; creatorCompany?: string; creatorRole?: string; createdAt?: number; acquiredAt?: number; metadata?: Record<string, unknown> }> = [];
          for (const c of comps) {
            try {
              const view = await getTokenView(c.tokenId);
              const pname = String(view[2] ?? `Token ${c.tokenId}`);
              const pcreator = String(view[1] ?? "");
              const pcreatedAt = Number(view[7] ?? 0);
              const pfeatures = String(view[5] ?? "");
              const pmetadata = pfeatures ? (() => { try { return JSON.parse(pfeatures); } catch { return null; } })() : null;
              let pcompany: string | undefined; let prole: string | undefined;
              try {
                const u = await getUserInfo(pcreator);
                pcompany = String(u[5] ?? "");
                prole = String(u[2] ?? "");
              } catch {}
              // Buscar fecha de adquisición por el creador del token actual
              let acquiredAt: number | undefined = undefined;
              try {
                const txIds = await getUserTransfers(data.creator);
                let latest = 0;
                for (const tid of txIds) {
                  try {
                    const t = await getTransfer(Number(tid));
                    const to = String(t[2] ?? "").toLowerCase();
                    const tok = Number(t[3] ?? -1);
                    const status = Number(t[6] ?? -1);
                    const when = Number(t[4] ?? 0);
                    if (to === data.creator.toLowerCase() && tok === c.tokenId && status === 1) {
                      if (when > latest) latest = when;
                    }
                  } catch {}
                }
                if (latest > 0) acquiredAt = latest;
              } catch {}
              enriched.push({ tokenId: c.tokenId, amount: c.amount, name: pname, creator: pcreator, creatorCompany: pcompany, creatorRole: prole, createdAt: pcreatedAt, acquiredAt, metadata: pmetadata || undefined });
            } catch (e) {
              handleBlockOutOfRange(e);
              enriched.push({ tokenId: c.tokenId, amount: c.amount });
            }
          }
          if (!cancelled) setInputs(enriched);

          // Para cada token padre, obtener sus componentes (abuelos) para poder listar productores por cada fabricación
          const map: Record<number, Array<{ tokenId: number; amount: bigint; name?: string; creator?: string; creatorCompany?: string; creatorRole?: string; createdAt?: number; acquiredAt?: number; metadata?: Record<string, unknown> }>> = {};
          for (const parent of enriched) {
            try {
              const g = await getTokenInputs(parent.tokenId);
              const arr: Array<{ tokenId: number; amount: bigint; name?: string; creator?: string; creatorCompany?: string; creatorRole?: string; createdAt?: number; acquiredAt?: number; metadata?: Record<string, unknown> }> = [];
              for (const gi of g) {
                try {
                  const gv = await getTokenView(gi.tokenId);
                  const gname = String(gv[2] ?? `Token ${gi.tokenId}`);
                  const gcreator = String(gv[1] ?? "");
                  const gcreatedAt = Number(gv[7] ?? 0);
                  const gfeatures = String(gv[5] ?? "");
                  const gmetadata = gfeatures ? (() => { try { return JSON.parse(gfeatures); } catch { return null; } })() : null;
                  let gcompany: string | undefined; let grole: string | undefined;
                  try {
                    const u = await getUserInfo(gcreator);
                    gcompany = String(u[5] ?? "");
                    grole = String(u[2] ?? "");
                  } catch {}
                  // Fecha de adquisición por el FABRICANTE (parent.creator) del token del productor
                  let gacq: number | undefined = undefined;
                  try {
                    const txIds = parent.creator ? await getUserTransfers(parent.creator) : [];
                    let latest = 0;
                    for (const tid of txIds) {
                      try {
                        const t = await getTransfer(Number(tid));
                        const to = String(t[2] ?? "").toLowerCase();
                        const tok = Number(t[3] ?? -1);
                        const status = Number(t[6] ?? -1);
                        const when = Number(t[4] ?? 0);
                        if (parent.creator && to === parent.creator.toLowerCase() && tok === gi.tokenId && status === 1) {
                          if (when > latest) latest = when;
                        }
                      } catch {}
                    }
                    if (latest > 0) gacq = latest;
                  } catch {}
                  arr.push({ tokenId: gi.tokenId, amount: gi.amount, name: gname, creator: gcreator, creatorCompany: gcompany, creatorRole: grole, createdAt: gcreatedAt, acquiredAt: gacq, metadata: gmetadata || undefined });
                } catch {}
              }
              map[parent.tokenId] = arr;
            } catch {}
          }
          if (!cancelled) setGrandInputsByParent(map);
        } catch (e) {
          handleBlockOutOfRange(e);
          if (!cancelled) setInputs([]);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(t("tokens.detail.errorLoading"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tokenId, fetchDetail]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Clasificar metadata según rol del creador
  const { knownMetadata, unknownMetadata } = useMemo(() => {
    const known: Record<string, unknown> = {};
    const unknown: Record<string, unknown> = {};
    if (detail?.metadata) {
      const role = creatorInfo?.role ?? "";
      const allow = KNOWN_BY_ROLE[role] ?? [];
      for (const [k, v] of Object.entries(detail.metadata)) {
        if (HIDDEN_METADATA.includes(k)) {
          // Ocultar estos campos
          continue;
        }
        if (allow.includes(k)) known[k] = v; else unknown[k] = v;
      }
    }
    return { knownMetadata: known, unknownMetadata: unknown };
  }, [detail?.metadata, creatorInfo?.role]);

  // Render helpers por etapas
  function Stage({
    titleKey,
    company,
    inputs: stageInputs,
    showComponents = true,
    componentLabelKey = "tokens.detail.stage.componentsUsed",
  }: {
    titleKey: string;
    company?: string;
    inputs?: typeof inputs;
    showComponents?: boolean;
    componentLabelKey?: string;
  }) {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t(titleKey)}</h3>
        <div className="rounded-2xl border border-surface bg-surface-2 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium">{company ?? t("tokens.detail.company.unknown")}</p>
          </div>
          {showComponents && stageInputs && stageInputs.length > 0 ? (
            <div className="mt-3 space-y-3">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t(componentLabelKey)}</p>
              <ul className="grid gap-3">
                {stageInputs.map((c, idx) => {
                  // Filtrar metadata para excluir campos ocultos
                  const filteredMetadata = c.metadata 
                    ? Object.entries(c.metadata)
                        .filter(([key]) => !HIDDEN_METADATA.includes(key))
                    : [];
                  
                  return (
                    <li key={`${c.tokenId}-${idx}`} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3 shadow-sm cursor-default">
                      {/* Header del token */}
                      <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex-1">
                          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            {t("dashboard.inventory.token", { id: c.tokenId })} · {c.name ?? t("tokens.common.fallbackNameShort", { id: c.tokenId })}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {t("tokens.detail.quantity")} <span className="font-semibold text-slate-800 dark:text-slate-200">{formatBigInt(c.amount, locale)}</span>
                          </p>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {c.acquiredAt ? formatDate(c.acquiredAt, locale) : c.createdAt ? formatDate(c.createdAt, locale) : ""}
                        </span>
                      </div>

                      {/* Metadata del token */}
                      {filteredMetadata.length > 0 ? (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          {filteredMetadata.map(([key, value]) => (
                            <div key={key} className="space-y-1">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                {formatKey(key)}
                              </p>
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                {formatValue(value, locale)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs italic text-slate-400 dark:text-slate-500">
                          {t("tokens.detail.noExtraMetadata")}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (!tokenId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className={`relative w-full max-w-3xl max-h-[90vh] overflow-auto rounded-3xl border bg-white shadow-2xl dark:bg-slate-900 scrollbar-hide ${theme.containerBorder}`}>
        <style jsx>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
        <div className={`sticky top-0 z-10 flex items-center justify-between border-b bg-gradient-to-r ${theme.gradient} px-6 py-4 text-white ${theme.containerBorder}`}>
          <h2 className="text-lg font-semibold">
            {loading
              ? t("common.loading")
              : detail
                ? detail.name || t("dashboard.inventory.token", { id: detail.id })
                : t("dashboard.inventory.token", { id: tokenId })}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 transition hover:bg-white/20"
            aria-label={t("common.close")}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
              {error}
            </div>
          )}

          {detail && !loading && (
            <>
              {/* Dato principal: nombre y descripción en tarjeta blanca */}
              <section>
                <div className="rounded-2xl border border-surface bg-white p-5 shadow-sm cursor-default space-y-3">
                  <div>
                    <p className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                      {detail.name || t("dashboard.inventory.token", { id: detail.id })}
                    </p>
                    <div className="mt-1">
                      <TokenTxHash tokenId={detail.id} chainId={31337} showFull={true} className="text-sm font-semibold text-slate-800 dark:text-slate-200" />
                    </div>
                  </div>
                  {detail.description ? (
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{detail.description}</p>
                  ) : null}
                </div>
              </section>

              {/* Información básica: solo fecha de creación */}
              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t("tokens.detail.section.info")}</h3>
                <div className="grid gap-3">
                  <div className="rounded-2xl border border-surface bg-surface-2 p-4 cursor-default">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{t("tokens.detail.creationDate")}</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                      {detail.createdAt ? formatDate(detail.createdAt, locale) : t("common.notAvailable")}
                    </p>
                  </div>
                </div>
              </section>

              {/* Metadata predefinida por tipo */}
              {Object.keys(knownMetadata).length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t("tokens.detail.section.features")}</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {Object.entries(knownMetadata).map(([key, value]) => (
                      <div key={key} className="rounded-2xl border border-surface bg-surface-2 p-4 cursor-default">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{formatKey(key)}</p>
                        <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{formatValue(value)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Metadata adicional (no predefinida) */}
              {Object.keys(unknownMetadata).length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{t("tokens.detail.section.metadata")}</h3>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950 cursor-default">
                    <pre className="text-xs text-slate-700 dark:text-slate-300 overflow-x-auto">
                      {JSON.stringify(unknownMetadata, null, 2)}
                    </pre>
                  </div>
                </section>
              )}

              {/* Cadena por etapas (orden: Minorista -> Fabricante -> Productor) */}
              {(() => {
                const viewer = activeRole;
                const creatorRole = creatorInfo?.role;

                const blocks: ReactNode[] = [];

                // 1) Minorista (arriba): solo si el creador es Retailer, sin componentes
                if (creatorRole === "Retailer") {
                  blocks.push(
                    <Stage
                      key="r"
                      titleKey="tokens.detail.stage.retailer"
                      company={creatorInfo?.company || undefined}
                      showComponents={false}
                    />
                  );
                }

                // 2) Fabricante(s): Mostrar las fábricas que generaron tokens
                if (creatorRole === "Factory") {
                  // Este token fue creado por una fábrica - mostrar sin componentes
                  blocks.push(
                    <Stage
                      key="f-self"
                      titleKey="tokens.detail.stage.factory"
                      company={creatorInfo?.company || undefined}
                      showComponents={false}
                    />
                  );
                } else if (creatorRole === "Retailer") {
                  // Cada token padre (role Factory) - mostrar empresa fabricante Y sus tokens con fechas
                  const factoryTokensMap = new Map<string, Array<{tokenId: number; name: string; amount: bigint; createdAt?: number}>>();

                  inputs.filter(p => p.creatorRole === "Factory").forEach((p) => {
                    const company = p.creatorCompany || t("tokens.detail.stage.factoryUnknown");
                    if (!factoryTokensMap.has(company)) {
                      factoryTokensMap.set(company, []);
                    }
                    factoryTokensMap.get(company)!.push({
                      tokenId: p.tokenId,
                      name: p.name || t("tokens.common.fallbackNameShort", { id: p.tokenId }),
                      amount: p.amount,
                      createdAt: p.createdAt
                    });
                  });

                  // Crear un Stage por cada empresa fabricante con sus tokens
                  factoryTokensMap.forEach((tokens, company) => {
                    blocks.push(
                      <Stage
                        key={`f-${company}`}
                        titleKey="tokens.detail.stage.factory"
                        company={company}
                        inputs={tokens as any}
                        showComponents={true}
                        componentLabelKey="tokens.detail.stage.componentsBuilt"
                      />
                    );
                  });
                }

                // 3) Productor(es) (abajo): Mostrar los datos de los productores
                // Agrupar tokens de productores por empresa
                const producersByCompany = new Map<string, Array<{tokenId: number; name: string; amount: bigint; createdAt?: number}>>();
                
                if (creatorRole === "Producer") {
                  // Es productor directo - solo mostrar la empresa sin componentes
                  blocks.push(
                    <Stage
                      key="p-direct"
                      titleKey="tokens.detail.stage.producer"
                      company={creatorInfo?.company || undefined}
                      showComponents={false}
                    />
                  );
                } else if (creatorRole === "Factory") {
                  // Los productores son los inputs directos - agrupar por empresa
                  inputs.filter(i => i.creatorRole === "Producer").forEach((i) => {
                    const company = i.creatorCompany || t("tokens.detail.stage.producerUnknown");
                    if (!producersByCompany.has(company)) {
                      producersByCompany.set(company, []);
                    }
                    producersByCompany.get(company)!.push({
                      tokenId: i.tokenId,
                      name: i.name || t("tokens.common.fallbackNameShort", { id: i.tokenId }),
                      amount: i.amount,
                      createdAt: i.createdAt
                    });
                  });
                } else if (creatorRole === "Retailer") {
                  // Los productores son los abuelos (inputs de los tokens de fábrica) - agrupar por empresa
                  inputs.forEach(p => {
                    const g = grandInputsByParent[p.tokenId] || [];
                    g.forEach((gi: any) => {
                      const company = gi.creatorCompany || t("tokens.detail.stage.producerUnknown");
                      if (!producersByCompany.has(company)) {
                        producersByCompany.set(company, []);
                      }
                      producersByCompany.get(company)!.push({
                        tokenId: gi.tokenId,
                        name: gi.name || t("tokens.common.fallbackNameShort", { id: gi.tokenId }),
                        amount: gi.amount,
                        createdAt: gi.createdAt
                      });
                    });
                  });
                }

                // Crear un Stage por cada empresa productora con sus tokens
                producersByCompany.forEach((tokens, company) => {
                  blocks.push(
                    <Stage
                      key={`p-${company}`}
                      titleKey="tokens.detail.stage.producer"
                      company={company}
                      inputs={tokens as any}
                      showComponents={true}
                      componentLabelKey="tokens.detail.stage.componentsUsed"
                    />
                  );
                });

                // Visibilidad por rol del VISOR
                const visible = (() => {
                  if (!viewer || viewer === "Producer") {
                    return blocks.filter(b => String((b as any).key).startsWith("p-"));
                  }
                  if (viewer === "Factory") {
                    return blocks.filter(b => String((b as any).key).startsWith("p-"));
                  }
                  if (viewer === "Retailer") {
                    return blocks.filter(b => String((b as any).key).startsWith("f-") || String((b as any).key).startsWith("p-"));
                  }
                  // Consumer/Admin ven todo el camino
                  return blocks;
                })();

                return <section className="space-y-4">{visible}</section>;
              })()}
            </>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-surface bg-surface-1 px-6 py-4">
          <button
            onClick={onClose}
            className={`w-full rounded-full px-4 py-2 text-sm font-semibold transition ${theme.btnPrimary}`}
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
