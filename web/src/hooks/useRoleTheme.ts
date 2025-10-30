// web/src/hooks/useRoleTheme.ts
"use client";

import { useMemo } from "react";
import { useRole } from "@/contexts/RoleContext";
import { getRoleTheme, ROLE_THEMES, type RoleTheme } from "@/lib/roleTheme";

export function useRoleTheme(): { theme: RoleTheme; roleKey: keyof typeof ROLE_THEMES } {
  const { activeRole } = useRole();
  const theme = useMemo(() => getRoleTheme(activeRole), [activeRole]);
  const roleKey = (activeRole && (ROLE_THEMES as Record<string, RoleTheme | undefined>)[activeRole]
    ? (activeRole as keyof typeof ROLE_THEMES)
    : "Producer") as keyof typeof ROLE_THEMES;
  return { theme, roleKey };
}
