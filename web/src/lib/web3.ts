// web/src/lib/web3.ts
"use client";
import { BrowserProvider, Contract, JsonRpcSigner, Interface, isAddress } from "ethers";
import abiJson from "@/contracts/SupplyChain.abi.json";
import { CONTRACT_CONFIG } from "@/contracts/config";

declare global { interface Window { ethereum?: any } }

// Patch window.ethereum.request to force eth_call to use blockTag 'latest', even if callers pass a number
function patchEthereumRequest() {
  try {
    if (typeof window === "undefined") return;
    const eth: any = window.ethereum;
    if (!eth || eth.__sc_reqPatched) return;
    const orig = eth.request?.bind(eth);
    if (typeof orig !== "function") return;
    eth.request = async (args: { method: string; params?: any[] }) => {
      if (args && args.method === "eth_call") {
        const p = Array.isArray(args.params) ? [...args.params] : [];
        if (p.length === 0) p.push({});
        if (p.length === 1) p.push("latest"); else p[1] = "latest";
        return orig({ ...args, params: p });
      }
      return orig(args);
    };
    eth.__sc_reqPatched = true;
  } catch {
    // noop: if provider shape differs
  }
}

// Apply immediately on module load (client only)
try { patchEthereumRequest(); } catch {}

// Acepta ABI en cualquiera de los formatos comunes (array, {abi}, etc.)
function pickAbi(j: any) {
  if (Array.isArray(j)) return j;
  if (Array.isArray(j?.abi)) return j.abi;
  if (Array.isArray(j?.default)) return j.default;
  if (Array.isArray(j?.output?.abi)) return j.output.abi;
  return new Interface([]); // vacío, pero no crashea TS
}
const ABI = pickAbi(abiJson);

// Dirección dinámica: primero override en localStorage, luego config/env
export function getCurrentContractAddress(): string {
  let override = "";
  try {
    if (typeof window !== "undefined") {
      override = (localStorage.getItem("contract.address") || "").trim();
    }
  } catch {}
  const fromCfg = (CONTRACT_CONFIG?.address ?? process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "").trim();
  return (override || fromCfg).trim();
}

export function setContractAddress(addr: string) {
  const next = (addr || "").trim();
  if (!next) return;
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem("contract.address", next);
    }
  } catch {}
  resetProvider();
}

let _provider: BrowserProvider | null = null;

// Allow contexts to reset the cached provider after chain resets/redeploys
export function resetProvider() {
  _provider = null;
}

export function getProvider(): BrowserProvider {
  if (!_provider) {
    if (typeof window === "undefined" || !window.ethereum) throw new Error("No hay wallet inyectada");
    // Ensure ethereum.request is patched before constructing the BrowserProvider
    try { patchEthereumRequest(); } catch {}
    const p = new BrowserProvider(window.ethereum, "any"); // sin checks de red

    // Desactivar ENS globalmente (no lo usás)
    (p as any).lookupAddress = async () => null;
    (p as any).resolveName = async (v: string) => (isAddress(v) ? v : v);

    // Harden against BlockOutOfRange after chain resets: force eth_call to use 'latest'
    try {
      const origCall = (p as any).call?.bind(p);
      if (typeof origCall === "function") {
        (p as any).call = async (tx: any, blockTag?: any) => {
          // Always use 'latest' to avoid asking for non-existent past/future blocks
          return origCall(tx, "latest");
        };
      }
    } catch {
      // noop if provider shape changes
    }

    // Extra guard: some internals may route directly through send("eth_call", ...)
    try {
      const origSend = (p.send as (method: string, params: any[] | Record<string, any>) => Promise<any>).bind(p);
      p.send = async (method: string, params: any[] | Record<string, any>) => {
        if (method === "eth_call") {
          const arr: any[] = Array.isArray(params) ? [...params] : [];
          // Normalize to [tx, "latest"]
          if (arr.length === 0) arr.push({});
          if (arr.length === 1) arr.push("latest");
          else arr[1] = "latest";
          return origSend(method, arr);
        }
        return origSend(method, params);
      };
    } catch {
      // ignore if provider API differs
    }

    // Marcar como parcheado
    (p as any).__sc_patched = true;
    _provider = p;
  }
  // Asegurar que el proveedor existente está parcheado (puede venir de versiones previas en memoria)
  try {
    const p: any = _provider as any;
    if (!p.__sc_patched) {
      // Desactivar ENS
      p.lookupAddress = async () => null;
      p.resolveName = async (v: string) => (isAddress(v) ? v : v);
      // Forzar latest en call
      if (typeof p.call === "function" && !p.__sc_callPatched) {
        const origCall = p.call.bind(p);
        p.call = async (tx: any, blockTag?: any) => origCall(tx, "latest");
        p.__sc_callPatched = true;
      }
      // Forzar latest en send('eth_call', ...)
      if (typeof p.send === "function" && !p.__sc_sendPatched) {
        const origSend = (p.send as (method: string, params: any[] | Record<string, any>) => Promise<any>).bind(p);
        p.send = async (method: string, params: any[] | Record<string, any>) => {
          if (method === "eth_call") {
            const arr: any[] = Array.isArray(params) ? [...params] : [];
            if (arr.length === 0) arr.push({});
            if (arr.length === 1) arr.push("latest");
            else arr[1] = "latest";
            return origSend(method, arr);
          }
          return origSend(method, params);
        };
        p.__sc_sendPatched = true;
      }
      p.__sc_patched = true;
    }
  } catch {}
  return _provider!;
}

export async function getSigner(): Promise<JsonRpcSigner> {
  const p = getProvider();
  await p.send("eth_requestAccounts", []);
  return p.getSigner();
}

// 👇 Firma que espera sc.ts: getContract(withSigner: boolean)
export async function getContract(withSigner: boolean) {
  const ADDRESS = getCurrentContractAddress();
  if (!ADDRESS || !isAddress(ADDRESS)) {
    throw new Error("Invalid contract address. Set NEXT_PUBLIC_CONTRACT_ADDRESS y reconstruye el frontend.");
  }
  const runner = withSigner ? await getSigner() : getProvider();

  // Sanity check opcional (si hay provider disponible)
  const prov: any = (runner as any).provider ?? runner;
  if (prov?.getCode) {
    try {
      const code = await prov.getCode(ADDRESS);
      if (code === "0x") throw new Error(`No hay contrato desplegado en ${ADDRESS} en esta red.`);
    } catch { /* ignorar si el nodo no permite getCode */ }
  }

  return new Contract(ADDRESS, ABI as any, runner);
}
