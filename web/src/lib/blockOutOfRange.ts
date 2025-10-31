// web/src/lib/blockOutOfRange.ts
// Helper to detect BlockOutOfRange/chain reset errors and force full session cleanup
import { resetProvider } from "@/lib/web3";

export function handleBlockOutOfRange(err: unknown): boolean {
  const msg = (typeof err === "string" ? err : (err as any)?.message || "") as string;
  if (/BlockOutOfRange|block height|eth_call/i.test(msg)) {
    try {
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
      }
    } catch {}
    try { resetProvider(); } catch {}
    if (typeof window !== "undefined") window.location.reload();
    return true;
  }
  return false;
}
