"use client";
import { useWeb3 } from "@/contexts/Web3Context";
import { useI18n } from "@/contexts/I18nContext";

export default function ConnectBanner() {
  const { mustConnect, reconnect, switchAcc, error } = useWeb3();
  const { t } = useI18n();
  if (!mustConnect) return null;
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-amber-300/70 bg-amber-50/80 px-4 py-4 text-sm text-amber-900 shadow-[0_14px_40px_-32px_rgba(253,176,34,0.65)] backdrop-blur dark:border-amber-300/40 dark:bg-amber-500/10 dark:text-amber-100">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{t("connect.banner.title")}</span>
        {error && <span className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={reconnect}
          className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-amber-500/30 transition hover:brightness-110 focus-outline-accent"
        >
          {t("connect.banner.connect")}
        </button>
        <button
          onClick={switchAcc}
          className="rounded-full border border-amber-300/70 px-4 py-2 text-xs font-semibold text-amber-800 transition hover:border-amber-500 hover:text-amber-700 focus-outline-accent dark:border-amber-300/40 dark:text-amber-100 dark:hover:text-white"
        >
          {t("connect.banner.switch")}
        </button>
      </div>
    </div>
  );
}
