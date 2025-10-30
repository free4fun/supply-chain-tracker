import Link from "next/link";
import type { RoleTheme } from "../../lib/roleTheme";

const ROLE_LINKS: Record<string, { href: string; labelKey: string }[]> = {
    Producer: [
        { href: "/tokens", labelKey: "dashboard.quickLinks.viewTokens" },
        { href: "/tokens/create", labelKey: "dashboard.quickLinks.createToken" },
        { href: "/transfers", labelKey: "dashboard.quickLinks.viewTransfers" },
    ],
    Factory: [
        { href: "/tokens", labelKey: "dashboard.quickLinks.viewTokens" },
        { href: "/tokens/create", labelKey: "dashboard.quickLinks.createToken" },
        { href: "/transfers", labelKey: "dashboard.quickLinks.viewTransfers" },
    ],
    Retailer: [
        { href: "/tokens", labelKey: "dashboard.quickLinks.viewTokens" },
        { href: "/tokens/create", labelKey: "dashboard.quickLinks.createToken" },
        { href: "/transfers", labelKey: "dashboard.quickLinks.viewTransfers" },
    ],
    Consumer: [
        { href: "/tokens", labelKey: "dashboard.quickLinks.viewTokens" },
        { href: "/transfers", labelKey: "dashboard.quickLinks.viewTransfers" },
    ],
};

export default function QuickLinks({
    activeRole,
    theme,
    t,
}: {
    activeRole?: string;
    theme: RoleTheme;
    t: (key: string) => string;
}) {
    return (
        <section className={`space-y-3 rounded-3xl border ${theme.accentBorder} bg-white dark:bg-slate-900 p-6 shadow-inner`}>
            <h2 className="text-sm text-slate-700 dark:text-slate-300">{t("dashboard.activity.timeline")}</h2>
            <div className="flex flex-wrap items-center gap-2">
               
            </div>
        </section>
    );
}
