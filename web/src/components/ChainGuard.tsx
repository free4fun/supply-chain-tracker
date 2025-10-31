"use client";
import { useState } from "react";
import { useWeb3 } from "@/contexts/Web3Context";
import { useI18n } from "@/contexts/I18nContext";
import { handleBlockOutOfRange } from "@/lib/blockOutOfRange";

const ANVIL_HEX = "0x7a69"; // 31337

export default function ChainGuard({ children }: { children: React.ReactNode }) {
  const { chainId, ready } = useWeb3();
  const [msg, setMsg] = useState("");
  const { t } = useI18n();

  async function switchChain() {
    const eth = (window as any).ethereum;
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ANVIL_HEX }] });
    } catch (e: any) {
      if (!handleBlockOutOfRange(e)) {
        if (e?.code === 4902) {
          await eth.request({ method: "wallet_addEthereumChain", params: [{
            chainId: ANVIL_HEX,
            chainName: "Anvil 31337",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545"],
          }]});
        } else {
          setMsg(e?.message ?? t("chainGuard.error"));
        }
      }
    }
  }

  if (!ready) {
    return (
      <div className="rounded-3xl border border-surface bg-surface-1 px-4 py-3 text-sm text-slate-600 shadow-sm dark:text-slate-300">
        {t("chainGuard.loading")}
      </div>
    );
  }

  return (
    <>
      {chainId && chainId !== 31337 ? (
        <div className="rounded-3xl border border-amber-400/60 bg-amber-100/70 px-4 py-4 text-sm text-amber-900 shadow-[0_18px_45px_-30px_rgba(217,119,6,0.6)] backdrop-blur dark:border-amber-300/50 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{t("chainGuard.wrongNetwork", { chain: "31337" })}</span>
            <button
              onClick={switchChain}
              className="rounded-full border border-amber-400/60 px-3 py-1 text-xs font-semibold text-amber-800 transition hover:border-amber-500 hover:text-amber-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:border-amber-300/50 dark:text-amber-100 dark:hover:text-white"
            >
              {t("chainGuard.switch")}
            </button>
            {msg && <span className="text-xs font-medium text-rose-500 dark:text-rose-300">{msg}</span>}
          </div>
        </div>
      ) : null}
      {children}
    </>
  );
}
