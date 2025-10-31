"use client";
import { useEffect, useState } from "react";
import { useWeb3 } from "@/contexts/Web3Context";
import { getCurrentContractAddress } from "@/lib/web3";

export default function RedeployBanner() {
  const { disconnect, account } = useWeb3();
  const [show, setShow] = useState(false);
  const [addr, setAddr] = useState<string>("");

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const flag = localStorage.getItem("web3.redeployDetected") === "1";
      setShow(flag);
      setAddr(getCurrentContractAddress());
    } catch {
      setShow(false);
    }
  }, [account]);

  if (!show) return null;

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium">Se detectó un reinicio o redeploy del contrato</div>
          <div className="text-sm opacity-90">Dirección actual: <code className="font-mono">{addr}</code>. Es posible que necesites reconectar.</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { try { localStorage.removeItem("web3.redeployDetected"); } catch {}; setShow(false); }}
            className="rounded border border-amber-400 px-3 py-1 text-sm hover:bg-amber-100"
          >Ocultar</button>
          <button
            onClick={() => { try { localStorage.removeItem("web3.redeployDetected"); } catch {}; setShow(false); disconnect(); }}
            className="rounded bg-amber-600 px-3 py-1 text-sm text-white hover:bg-amber-700"
          >Reconectar</button>
        </div>
      </div>
    </div>
  );
}
