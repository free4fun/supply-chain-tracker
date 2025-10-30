// web/src/hooks/useRequireAuth.ts
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWeb3 } from "@/contexts/Web3Context";

/**
 * Hook que redirige a home si no hay cuenta conectada.
 * Usar en páginas que requieren autenticación.
 */
export function useRequireAuth() {
  const router = useRouter();
  const { account, ready } = useWeb3();

  useEffect(() => {
    if (ready && !account) {
      router.push("/");
    }
  }, [ready, account, router]);

  return { account, ready };
}
