"use client";
import { useWeb3 } from "@/contexts/Web3Context";

export default function ConnectBanner() {
  const { mustConnect, reconnect, switchAcc, error } = useWeb3();
  if (!mustConnect) return null;
  return (
    <div className="bg-yellow-50 border-b border-yellow-200 text-sm p-3 flex items-center justify-center gap-3">
      <span>Conectá tu wallet para operar.</span>
      <button onClick={reconnect} className="px-3 py-1 rounded bg-black text-white">Conectar</button>
      <button onClick={switchAcc} className="px-3 py-1 rounded border">Cambiar cuenta</button>
      {error && <span className="text-red-600 ml-2">{error}</span>}
    </div>
  );
}
