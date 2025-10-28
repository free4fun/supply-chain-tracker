// web/src/contexts/Web3Context.tsx
"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { BrowserProvider } from "ethers";

type EIP1193 = {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  addEventListener?: (ev: "accountsChanged" | "chainChanged", cb: (...a: any[]) => void) => void;
  removeEventListener?: (ev: "accountsChanged" | "chainChanged", cb: (...a: any[]) => void) => void;
};

function getEip1193(): EIP1193 | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as any).ethereum as EIP1193 | undefined;
}

const readChainId = async (eth: EIP1193): Promise<number | undefined> => {
  try {
    const id = await eth.request({ method: "eth_chainId" });
    if (typeof id === "string") return parseInt(id, 16);
    if (typeof id === "number") return id;
  } catch {}
  return undefined;
};

// Envuelve llamadas a la wallet y NO propaga el rejection 4001 (cancelado por el usuario)
async function safeRequest<T = any>(eth: EIP1193, method: string, params?: any[]): Promise<T | undefined> {
  try {
    return await eth.request({ method, params });
  } catch (e: any) {
    if (e?.code === 4001) return undefined; // canceló
    throw e; // otros errores sí se propagan
  }
}

export type Web3State = {
  ready: boolean;
  mustConnect: boolean;
  account?: string;
  chainId?: number;
  error?: string;
  connect: () => Promise<void>;
  reconnect: () => Promise<void>;
  switchAcc: () => Promise<void>;
  disconnect: () => void;
  getProvider: () => BrowserProvider | undefined;
};

const Ctx = createContext<Web3State | null>(null);
export const useWeb3 = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Web3Context missing");
  return ctx;
};

export function Web3Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<Web3State, "connect" | "disconnect" | "getProvider" | "reconnect" | "switchAcc">>({
    ready: false,
    mustConnect: true,
    account: undefined,
    chainId: undefined,
    error: undefined,
  });

  // 1) Silencia SOLO el spam de "User rejected the request." de la wallet
  useEffect(() => {
    const orig = console.error;
    console.error = (...args: any[]) => {
      const s = args.map(a => (typeof a === "string" ? a : a?.message ? String(a.message) : "")).join(" ");
      if (/User rejected the request/i.test(s)) return;
      orig(...args);
    };
    return () => { console.error = orig; };
  }, []);

  // 2) Bootstrap de estado con cuentas ya autorizadas + listeners
  useEffect(() => {
    const eth = getEip1193();
    if (!eth) {
      setState({ ready: true, mustConnect: true, account: undefined, chainId: undefined, error: "No se detectó wallet" });
      return;
    }

    (async () => {
      try {
        const [accs, cid] = await Promise.all([
          eth.request({ method: "eth_accounts" }),
          readChainId(eth),
        ]);
        setState(s => ({
          ...s,
          ready: true,
          account: accs?.[0],
          mustConnect: !(accs && accs[0]),
          chainId: cid,
          error: undefined,
        }));
      } catch {
        setState(s => ({ ...s, ready: true, mustConnect: true }));
      }
    })();

    const onAcc = (a: string[]) =>
      setState(s => ({ ...s, account: a?.[0], mustConnect: !(a && a[0]) }));
    const onChain = (hex: string | number) =>
      setState(s => ({ ...s, chainId: typeof hex === "string" ? parseInt(hex, 16) : Number(hex) }));

    eth.addEventListener?.("accountsChanged", onAcc);
    eth.addEventListener?.("chainChanged", onChain);
    return () => {
      eth.removeEventListener?.("accountsChanged", onAcc);
      eth.removeEventListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = async () => {
    const eth = getEip1193();
    if (!eth) {
      setState(s => ({ ...s, error: "No hay wallet inyectada", mustConnect: true }));
      return;
    }
    try {
      const accs = await safeRequest<string[]>(eth, "eth_requestAccounts");
      if (!accs || !accs[0]) {
        // canceló o no eligió cuenta
        setState(s => ({ ...s, error: "Conexión rechazada. Conectá la wallet para continuar.", mustConnect: true }));
        return;
      }
      const cid = await readChainId(eth);
      setState(s => ({ ...s, account: accs[0], mustConnect: false, chainId: cid, error: undefined }));
    } catch (e: any) {
      setState(s => ({ ...s, error: e?.message ?? "Error al conectar", mustConnect: true }));
    }
  };

  const reconnect = async () => connect();

  const switchAcc = async () => {
    const eth = getEip1193();
    if (!eth) {
      setState(s => ({ ...s, error: "No hay wallet inyectada" }));
      return;
    }
    try {
      const perm = await safeRequest<any>(eth, "wallet_requestPermissions", [{ eth_accounts: {} }]);
      if (!perm) {
        setState(s => ({ ...s, error: "Permiso rechazado.", mustConnect: true }));
        return;
      }
      await connect();
    } catch (e: any) {
      setState(s => ({ ...s, error: e?.message ?? "No se pudo cambiar de cuenta" }));
    }
  };

  const disconnect = () => {
    setState(s => ({ ...s, account: undefined, mustConnect: true }));
  };

  const getProvider = () => {
    const eth = getEip1193();
    if (!eth) return undefined;
    // Forzamos "any" para evitar checks de red y ENS
    return new BrowserProvider(eth, "any");
  };

  return (
    <Ctx.Provider value={{ ...state, connect, reconnect, switchAcc, disconnect, getProvider }}>
      {children}
    </Ctx.Provider>
  );
}
