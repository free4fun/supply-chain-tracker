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
  // Estilos unificados usando variables CSS
  // Cards clickeables
  cardBorder: string;
  cardHoverBorder: string;
  cardHoverShadow: string;
  // Containers NO clickeables
  containerBorder: string;
  // Inputs y selects
  inputBorder: string;
  inputFocusBorder: string;
  // Links y botones de navegación
  linkBorder: string;
  linkHoverBorder: string;
  linkHoverShadow: string;
  // Botones primarios y secundarios
  btnPrimary: string;
  btnSecondary: string;
  btnSecondaryHover: string;
};

export const ROLE_THEMES: Record<string, RoleTheme> = {
  None: {
    label: "Sin rol",
    gradient: "from-slate-400 to-slate-500",
    background: "bg-slate-50 dark:bg-slate-800/40",
    accentBorder: "border-surface",
    accentMuted: "bg-surface-2",
    intro: "Conectate para ver tu panel y acciones disponibles.",
    empty: "Sin datos para mostrar.",
    icon: "👤",
    accentHex: "#64748b",
    // Usando border-surface para neutral
    cardBorder: "border-slate-200 dark:border-slate-700",
    cardHoverBorder: "hover:border-slate-400 dark:hover:border-slate-500",
    cardHoverShadow: "hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-700/50",
    containerBorder: "border-slate-200 dark:border-slate-700",
    inputBorder: "border-slate-200 dark:border-slate-700",
  inputFocusBorder: "focus:border-accent-2",
    linkBorder: "border-slate-200 dark:border-slate-700",
    linkHoverBorder: "hover:border-accent",
    linkHoverShadow: "hover:shadow-md hover:shadow-accent/20",
    btnPrimary: "bg-gradient-to-r from-slate-600 to-slate-500 text-white shadow-md hover:brightness-110 disabled:opacity-60",
    btnSecondary: "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200",
    btnSecondaryHover: "hover:border-accent hover:text-accent hover:shadow-md hover:shadow-accent/20",
  },
  Producer: {
    label: "Viticultor",
    gradient: "from-emerald-500 to-lime-500",
    background: "bg-emerald-50 dark:bg-slate-800/40",
    accentBorder: "border-emerald-200 dark:border-emerald-500",
    accentMuted: "bg-emerald-100/80",
    intro: "Visualizá tus lotes de uvas y verificá qué cantidades siguen disponibles para nuevas transferencias o vinificaciones.",
    empty: "Aún no creaste lotes de uvas. Podés generar uno desde la sección Crear token.",
    icon: "🍇",
    accentHex: "#22c55e",
    // Usando variables CSS --accent
    cardBorder: "border-slate-200 dark:border-slate-700",
    cardHoverBorder: "hover:border-accent",
    cardHoverShadow: "hover:shadow-lg hover:shadow-accent/30",
    containerBorder: "border-slate-200 dark:border-slate-700",
    inputBorder: "border-slate-200 dark:border-slate-700",
  inputFocusBorder: "focus:border-accent-2",
    linkBorder: "border-slate-200 dark:border-slate-700",
    linkHoverBorder: "hover:border-accent",
    linkHoverShadow: "hover:shadow-md hover:shadow-accent/20",
    btnPrimary: "bg-gradient-accent text-white shadow-md hover:brightness-110 disabled:opacity-60",
    btnSecondary: "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200",
    btnSecondaryHover: "hover:border-accent hover:text-accent hover:shadow-md hover:shadow-accent/20",
  },
  Factory: {
    label: "Bodega",
    gradient: "from-rose-500 to-purple-600",
    background: "bg-rose-50 dark:bg-slate-800/40",
    accentBorder: "border-rose-200 dark:border-rose-500",
    accentMuted: "bg-rose-100/70",
    intro: "Seguimiento de cada vino elaborado, con el detalle de los lotes de uvas que fueron utilizados y las cantidades consumidas.",
    empty: "No tenés vinos disponibles. Transformá un lote de uvas aceptado para registrar tu producción.",
    icon: "🍷",
    accentHex: "#f43f5e",
    cardBorder: "border-slate-200 dark:border-slate-700",
    cardHoverBorder: "hover:border-accent",
    cardHoverShadow: "hover:shadow-lg hover:shadow-accent/30",
    containerBorder: "border-slate-200 dark:border-slate-700",
    inputBorder: "border-slate-200 dark:border-slate-700",
  inputFocusBorder: "focus:border-accent-2",
    linkBorder: "border-slate-200 dark:border-slate-700",
    linkHoverBorder: "hover:border-accent",
    linkHoverShadow: "hover:shadow-md hover:shadow-accent/20",
    btnPrimary: "bg-gradient-accent text-white shadow-md hover:brightness-110 disabled:opacity-60",
    btnSecondary: "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200",
    btnSecondaryHover: "hover:border-accent hover:text-accent hover:shadow-md hover:shadow-accent/20",
  },
  Retailer: {
    label: "Distribuidor",
    gradient: "from-amber-500 to-orange-500",
    background: "bg-amber-50 dark:bg-slate-800/40",
    accentBorder: "border-amber-200 dark:border-amber-500",
    accentMuted: "bg-amber-100/70",
    intro: "Armá y monitoreá tus packs especiales. Cada botella utilizada queda registrada para evitar duplicaciones.",
    empty: "Todavía no recibiste vinos para armar packs. Solicitá una transferencia a la bodega.",
    icon: "📦",
    accentHex: "#f59e0b",
    cardBorder: "border-slate-200 dark:border-slate-700",
    cardHoverBorder: "hover:border-accent",
    cardHoverShadow: "hover:shadow-lg hover:shadow-accent/30",
    containerBorder: "border-slate-200 dark:border-slate-700",
    inputBorder: "border-slate-200 dark:border-slate-700",
  inputFocusBorder: "focus:border-accent-2",
    linkBorder: "border-slate-200 dark:border-slate-700",
    linkHoverBorder: "hover:border-accent",
    linkHoverShadow: "hover:shadow-md hover:shadow-accent/20",
    btnPrimary: "bg-gradient-accent text-white shadow-md hover:brightness-110 disabled:opacity-60",
    btnSecondary: "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200",
    btnSecondaryHover: "hover:border-accent hover:text-accent hover:shadow-md hover:shadow-accent/20",
  },
  Consumer: {
    label: "Consumidor",
    gradient: "from-sky-500 to-indigo-500",
    background: "bg-sky-50 dark:bg-slate-800/40",
    accentBorder: "border-sky-200 dark:border-sky-500",
    accentMuted: "bg-sky-100/70",
    intro: "Explorá la trazabilidad completa de cada pack adquirido: origen, procesos y materias primas.",
    empty: "Aún no recibiste ningún pack registrado a tu nombre.",
    icon: "🧭",
    accentHex: "#0ea5e9",
    cardBorder: "border-slate-200 dark:border-slate-700",
    cardHoverBorder: "hover:border-accent",
    cardHoverShadow: "hover:shadow-lg hover:shadow-accent/30",
    containerBorder: "border-slate-200 dark:border-slate-700",
    inputBorder: "border-slate-200 dark:border-slate-700",
  inputFocusBorder: "focus:border-accent-2",
    linkBorder: "border-slate-200 dark:border-slate-700",
    linkHoverBorder: "hover:border-accent",
    linkHoverShadow: "hover:shadow-md hover:shadow-accent/20",
    btnPrimary: "bg-gradient-accent text-white shadow-md hover:brightness-110 disabled:opacity-60",
    btnSecondary: "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200",
    btnSecondaryHover: "hover:border-accent hover:text-accent hover:shadow-md hover:shadow-accent/20",
  },
};

export function getRoleTheme(role?: string): RoleTheme {
  return ROLE_THEMES[role ?? "None"] ?? ROLE_THEMES.None;
}
