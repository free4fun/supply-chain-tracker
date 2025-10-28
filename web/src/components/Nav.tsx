"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useRole } from "@/contexts/RoleContext";

type NavItem = {
  href: string;
  label: string;
  requireApproved?: boolean;
  roles?: string[];
  adminOnly?: boolean;
  allowAdmin?: boolean;
};

const items: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard", requireApproved: true },
  { href: "/tokens", label: "Tokens" },
  { href: "/tokens/create", label: "Crear activos", requireApproved: true, roles: ["Producer", "Factory"], allowAdmin: true },
  { href: "/transfers", label: "Transfers", requireApproved: true, roles: ["Producer", "Factory", "Retailer"], allowAdmin: true },
  { href: "/profile", label: "Profile" },
  { href: "/admin", label: "Admin", adminOnly: true },
  { href: "/admin/users", label: "Users", adminOnly: true },
];

export default function Nav() {
  const pathname = usePathname();
  const { activeRole, isApproved, isAdmin } = useRole();
  const allowedRole = activeRole ?? undefined;

  const tabs = items.filter(item => {
    if (item.adminOnly) return isAdmin;
    if (item.requireApproved && !isApproved) {
      return false;
    }
    if (item.roles && item.roles.length > 0) {
      if (item.roles.includes(allowedRole || "")) return true;
      if (item.allowAdmin && isAdmin) return true;
      return false;
    }
    if (item.allowAdmin && isAdmin) return true;
    return true;
  });

  return (
    <header className="rounded-3xl border border-white/20 bg-white/80 px-3 shadow-lg shadow-indigo-200/40 backdrop-blur dark:border-slate-800/40 dark:bg-slate-900/70 dark:shadow-black/20">
      <nav className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300">
        {tabs.map(t => {
          const isActive = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-full px-4 py-2 transition ${
                isActive
                  ? "bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-md shadow-indigo-400/30"
                  : "text-slate-600 hover:text-indigo-600 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-indigo-300"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
