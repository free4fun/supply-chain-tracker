"use client";
import { useEffect } from "react";
import { useRole } from "@/contexts/RoleContext";

function roleToClass(role?: string, isAdmin?: boolean) {
  if (isAdmin) return "theme-admin";
  const r = (role || "").toLowerCase();
  if (r === "producer") return "theme-producer";
  if (r === "factory") return "theme-factory";
  if (r === "retailer") return "theme-retailer";
  if (r === "consumer") return "theme-consumer";
  return "theme-none";
}

export default function ThemeController() {
  const { activeRole, isAdmin } = useRole();

  useEffect(() => {
    const cls = roleToClass(activeRole, isAdmin);
    const body = document.body;
    const all = ["theme-none","theme-producer","theme-factory","theme-retailer","theme-consumer","theme-admin"];
    for (const c of all) body.classList.remove(c);
    body.classList.add(cls);
  }, [activeRole, isAdmin]);

  return null;
}
