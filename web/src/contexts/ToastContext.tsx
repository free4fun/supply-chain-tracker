"use client";
import { createContext, useContext, useState, useCallback } from "react";

export type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; text: string };

const Ctx = createContext<{ push:(k:ToastKind,t:string)=>void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind:ToastKind, text:string) => {
    const id = Date.now() + Math.floor(Math.random()*1000);
    setItems(lst => [...lst, { id, kind, text }]);
    setTimeout(() => setItems(lst => lst.filter(x => x.id !== id)), 3500);
  }, []);
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {items.map(x => (
          <div key={x.id}
               className={`px-3 py-2 rounded shadow text-sm text-white ${
                 x.kind==="success"?"bg-green-600":x.kind==="error"?"bg-red-600":"bg-gray-800"
               }`}>
            {x.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("ToastProvider missing");
  return ctx;
};
