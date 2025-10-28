"use client";
import { useEffect, useState } from "react";
import { useWeb3 } from "@/contexts/Web3Context";

const ANVIL_HEX = "0x7a69"; // 31337

export default function ChainGuard({ children }: { children: React.ReactNode }) {
  const { chainId, ready } = useWeb3();
  const [msg, setMsg] = useState("");

  async function switchChain() {
    const eth = (window as any).ethereum;
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ANVIL_HEX }] });
    } catch (e: any) {
      if (e?.code === 4902) {
        await eth.request({ method: "wallet_addEthereumChain", params: [{
          chainId: ANVIL_HEX,
          chainName: "Anvil 31337",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: [process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545"],
        }]});
      } else {
        setMsg(e?.message ?? "Failed to switch chain");
      }
    }
  }

  if (!ready) return <div className="p-3 text-sm">Cargando…</div>;

return (
  <>
    {chainId && chainId !== 31337 ? (
      <div className="p-3 bg-yellow-50 border-b border-yellow-200 text-sm">
        Red incorrecta. Esperado 31337. <button onClick={switchChain} className="underline">Cambiar a Anvil</button>
        {msg && <span className="ml-2 text-red-600">{msg}</span>}
      </div>
    ) : null}
    {children}
  </>
);
}
