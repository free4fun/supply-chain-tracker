"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tokens", label: "Tokens" },
  { href: "/tokens/create", label: "Create" },
  { href: "/transfers", label: "Transfers" },
  { href: "/profile", label: "Profile" },
  { href: "/admin", label: "Admin" },
  { href: "/admin/users", label: "Users" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b">
      <nav className="mx-auto max-w-5xl flex gap-4 p-3">
        {tabs.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className={`text-sm px-3 py-1 rounded ${
              pathname === t.href ? "bg-black text-white" : "hover:bg-gray-100"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
