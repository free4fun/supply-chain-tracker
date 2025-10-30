// web/src/lib/roleTheme.ts
export type RoleTheme = {
  label: string;
  gradient: string;
  background: string;
  accentBorder: string;
  accentMuted: string;
  intro: string;
  empty: string;
  icon: string;
  accentHex: string;
};

export const ROLE_THEMES: Record<string, RoleTheme> = {
  Producer: {
    label: "Viticultor",
    gradient: "from-emerald-500 to-lime-500",
    background: "bg-emerald-50",
    accentBorder: "border-emerald-200",
    accentMuted: "bg-emerald-100/80",
    intro:
      "Visualizá tus lotes de uvas y verificá qué cantidades siguen disponibles para nuevas transferencias o vinificaciones.",
    empty:
      "Aún no creaste lotes de uvas. Podés generar uno desde la sección Crear token.",
    icon: "🍇",
    accentHex: "#22c55e",
  },
  Factory: {
    label: "Bodega",
    gradient: "from-rose-500 to-purple-600",
    background: "bg-rose-50",
    accentBorder: "border-rose-200",
    accentMuted: "bg-rose-100/70",
    intro:
      "Seguimiento de cada vino elaborado, con el detalle de los lotes de uvas que fueron utilizados y las cantidades consumidas.",
    empty:
      "No tenés vinos disponibles. Transformá un lote de uvas aceptado para registrar tu producción.",
    icon: "🍷",
    accentHex: "#f43f5e",
  },
  Retailer: {
    label: "Distribuidor",
    gradient: "from-amber-500 to-orange-500",
    background: "bg-amber-50",
    accentBorder: "border-amber-200",
    accentMuted: "bg-amber-100/70",
    intro:
      "Armá y monitoreá tus packs especiales. Cada botella utilizada queda registrada para evitar duplicaciones.",
    empty:
      "Todavía no recibiste vinos para armar packs. Solicitá una transferencia a la bodega.",
    icon: "📦",
    accentHex: "#f59e0b",
  },
  Consumer: {
    label: "Consumidor",
    gradient: "from-sky-500 to-indigo-500",
    background: "bg-sky-50",
    accentBorder: "border-sky-200",
    accentMuted: "bg-sky-100/70",
    intro:
      "Explorá la trazabilidad completa de cada pack adquirido: origen, procesos y materias primas.",
    empty: "Aún no recibiste ningún pack registrado a tu nombre.",
    icon: "🧭",
    accentHex: "#0ea5e9",
  },
};

export function getRoleTheme(role?: string): RoleTheme {
  return ROLE_THEMES[role ?? "Producer"] ?? ROLE_THEMES.Producer;
}
