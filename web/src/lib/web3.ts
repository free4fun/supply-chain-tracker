// web/src/lib/web3.ts
"use client";
import { BrowserProvider, Contract, JsonRpcSigner, Interface, isAddress } from "ethers";
import abiJson from "@/contracts/SupplyChain.abi.json";
import { CONTRACT_CONFIG } from "@/contracts/config";

declare global { interface Window { ethereum?: any } }

// Acepta ABI en cualquiera de los formatos comunes (array, {abi}, etc.)
function pickAbi(j: any) {
  if (Array.isArray(j)) return j;
  if (Array.isArray(j?.abi)) return j.abi;
  if (Array.isArray(j?.default)) return j.default;
  if (Array.isArray(j?.output?.abi)) return j.output.abi;
  return new Interface([]); // vacío, pero no crashea TS
}
const ABI = pickAbi(abiJson);

// Dirección desde config o env
const ADDRESS = (CONTRACT_CONFIG?.address ?? process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "").trim();

let _provider: BrowserProvider | null = null;

export function getProvider(): BrowserProvider {
  if (!_provider) {
    if (typeof window === "undefined" || !window.ethereum) throw new Error("No hay wallet inyectada");
    const p = new BrowserProvider(window.ethereum, "any"); // sin checks de red

    // Desactivar ENS globalmente (no lo usás)
    (p as any).lookupAddress = async () => null;
    (p as any).resolveName = async (v: string) => (isAddress(v) ? v : v);

    _provider = p;
  }
  return _provider;
}

export async function getSigner(): Promise<JsonRpcSigner> {
  const p = getProvider();
  await p.send("eth_requestAccounts", []);
  return p.getSigner();
}

// 👇 Firma que espera sc.ts: getContract(withSigner: boolean)
export async function getContract(withSigner: boolean) {
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
