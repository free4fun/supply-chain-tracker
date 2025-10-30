import Link from "next/link";
import type { RoleTheme } from "@/lib/roleTheme";

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
        <section className="space-y-3 rounded-3xl border border-surface bg-surface-1 p-6 shadow-inner">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("dashboard.activity.timeline")}</h3>
            <div className="flex flex-wrap items-center gap-2">
                {activeRole && ROLE_LINKS[activeRole] ? (
                    ROLE_LINKS[activeRole].map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`rounded-full bg-gradient-to-r ${theme.gradient} px-4 py-2 text-xs font-semibold !text-white shadow-md transition hover:brightness-110 focus-outline-accent`}
                        >
                            {t(link.labelKey)}
                        </Link>
                    ))
                ) : (
                    <Link
                        href="/tokens/create"
                        className={`rounded-full bg-gradient-to-r ${theme.gradient} px-4 py-2 text-xs font-semibold !text-white shadow-md transition hover:brightness-110 focus-outline-accent`}
                    >
                        {t("dashboard.quickLinks.createToken")}
                    </Link>
                )}
            </div>
        </section>
    );
}
