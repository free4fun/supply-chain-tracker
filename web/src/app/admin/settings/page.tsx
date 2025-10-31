"use client";
import { useEffect, useMemo, useState } from "react";
import { useRole } from "@/contexts/RoleContext";
import { useWeb3 } from "@/contexts/Web3Context";
import { getCurrentContractAddress, setContractAddress, resetProvider } from "@/lib/web3";
import { CONTRACT_CONFIG } from "@/contracts/config";
import { useToast } from "@/contexts/ToastContext";
import { handleBlockOutOfRange } from "@/lib/blockOutOfRange";

export default function AdminSettingsPage() {
  const { isAdmin } = useRole();
  const { disconnect } = useWeb3();
  const { push } = useToast();

  const defaultAddr = (CONTRACT_CONFIG?.address ?? process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "").trim();
  const [current, setCurrent] = useState<string>("");
  const [override, setOverride] = useState<string>("");
  const [forceOnReload, setForceOnReload] = useState<boolean>(false);

  useEffect(() => {
    setCurrent(getCurrentContractAddress());
    try {
      if (typeof window !== "undefined") setForceOnReload(localStorage.getItem("web3.forceDisconnectOnReload") === "1");
    } catch {}
  }, []);

  const hasOverride = useMemo(() => {
    return current && defaultAddr && current.toLowerCase() !== defaultAddr.toLowerCase();
  }, [current, defaultAddr]);

  if (!isAdmin) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800">No autorizado</div>
    );
  }

  const saveOverride = () => {
    try {
      const next = override.trim();
      if (!next) {
        push("error", "Ingresá una dirección válida");
        return;
      }
      setContractAddress(next);
      // Bandera para banner de reconexión
      try { if (typeof window !== "undefined") localStorage.setItem("web3.redeployDetected", "1"); } catch {}
      setCurrent(getCurrentContractAddress());
      try { if (typeof window !== "undefined") window.dispatchEvent(new Event("contract.address.changed")); } catch {}
      push("success", "Dirección de contrato actualizada");
    } catch (e: any) {
      if (!handleBlockOutOfRange(e)) {
        push("error", e?.message ?? "Error al guardar override");
      }
    }
  };

  const clearOverride = () => {
    try {
      if (typeof window !== "undefined") localStorage.removeItem("contract.address");
      resetProvider();
      try { if (typeof window !== "undefined") localStorage.setItem("web3.redeployDetected", "1"); } catch {}
      setCurrent(getCurrentContractAddress());
      try { if (typeof window !== "undefined") window.dispatchEvent(new Event("contract.address.changed")); } catch {}
      push("success", "Override eliminado; usando dirección por defecto");
    } catch (e: any) {
      if (!handleBlockOutOfRange(e)) {
        push("error", "No se pudo eliminar el override");
      }
    }
  };

  const doReset = () => {
    try {
      resetProvider();
      if (typeof window !== "undefined") localStorage.setItem("web3.redeployDetected", "1");
      disconnect();
      push("info", "Provider reseteado y sesión desconectada");
    } catch (e: any) {
      handleBlockOutOfRange(e);
    }
  };

  const toggleForceReload = () => {
    try {
      if (typeof window === "undefined") return;
      const next = !forceOnReload;
      setForceOnReload(next);
      if (next) localStorage.setItem("web3.forceDisconnectOnReload", "1");
      else localStorage.removeItem("web3.forceDisconnectOnReload");
      push("success", next ? "Se forzará desconexión en cada reload" : "Se conservará la sesión entre reloads");
    } catch {}
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Admin · Settings</h1>

      <section className="space-y-2">
        <h2 className="font-medium">Dirección del contrato</h2>
        <div className="rounded border p-3">
          <div className="text-sm">Por defecto: <code className="font-mono">{defaultAddr || "(no definida)"}</code></div>
          <div className="text-sm">Actual: <code className="font-mono">{current || "(no definida)"}</code>{hasOverride && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">override</span>}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={override}
              onChange={e => setOverride(e.target.value)}
              placeholder="0x..."
              className="w-full max-w-md rounded border px-2 py-1"
            />
            <button onClick={saveOverride} className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700">Guardar override</button>
            <button onClick={clearOverride} className="rounded border px-3 py-1 hover:bg-gray-50">Eliminar override</button>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Sesión y provider</h2>
        <div className="rounded border p-3 space-y-2">
          <div className="flex items-center gap-3">
            <button onClick={doReset} className="rounded bg-amber-600 px-3 py-1 text-white hover:bg-amber-700">Resetear provider y desconectar</button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={forceOnReload} onChange={toggleForceReload} />
            Forzar desconexión en cada recarga (solo dev)
          </label>
        </div>
      </section>
    </div>
  );
}
