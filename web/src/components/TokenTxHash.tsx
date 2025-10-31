"use client";

import React from 'react';
import { getTokenTxHash, formatTxHash, getExplorerUrl } from '@/lib/subgraph';
import { useI18n } from "@/contexts/I18nContext";

interface TokenTxHashProps {
  tokenId: number;
  chainId?: number;
  showFull?: boolean;
  variant?: 'card'; // Solo mantener 'card' para el estilo especial de tarjeta
  className?: string;
}

/**
 * Componente para mostrar el transaction hash de un token
 * Consulta automáticamente el subgraph y muestra el hash con link al explorer
 * El tamaño, peso y color de la fuente se controlan via className desde el padre
 */
export function TokenTxHash({
  tokenId,
  chainId = 31337,
  showFull = false,
  variant,
  className = ''
}: TokenTxHashProps) {
  const { t } = useI18n();
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    // Intentar obtener del localStorage primero
    const cached = localStorage.getItem(`tx_hash_${tokenId}`);
    if (cached) {
      setTxHash(cached);
      setLoading(false);
      return;
    }

    // Si no está en caché, consultar subgraph
    getTokenTxHash(tokenId)
      .then(hash => {
        if (hash) {
          setTxHash(hash);
          localStorage.setItem(`tx_hash_${tokenId}`, hash);
        }
      })
      .finally(() => setLoading(false));
  }, [tokenId]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (txHash) {
      await navigator.clipboard.writeText(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isCard = variant === 'card';
  
  if (loading) {
    return <span className={`animate-pulse ${className}`}>{t("tokens.hash.loading")}</span>;
  }

  if (!txHash) {
    return <span className={`italic ${className}`}>{t("tokens.hash.unavailable")}</span>;
  }

  const displayHash = showFull ? txHash : formatTxHash(txHash);
  const explorerUrl = getExplorerUrl(txHash, chainId);

  // Estilo de tarjeta completo (para modal y detalles)
  if (isCard) {
    return (
      <div className={`rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50 ${className}`}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            {t("tokens.hash.label")}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              title={t("tokens.hash.copyTitle")}
            >
              {copied ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            {chainId !== 31337 && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                title={t("tokens.hash.viewExplorer")}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>
      <code className="block text-xs font-mono text-slate-700 dark:text-slate-300 break-all">
        {txHash}
      </code>
    </div>
  );
}

// Estilo inline (por defecto)
  return (
    <div className={`inline-flex items-center gap-2`}>
      <code className={`font-mono ${className}`}>
        {displayHash}
      </code>
      <button
        onClick={handleCopy}
        className="hover:opacity-80 transition-opacity"
        title={t("tokens.hash.copyTitle")}
      >
        {copied ? (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
      {chainId !== 31337 && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs hover:opacity-80 transition-opacity text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
          title={t("tokens.hash.viewExplorer")}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
}

/**
 * Ejemplo de uso en TokenDetailModal
 */
export function TokenHeader({ tokenId, chainId }: { tokenId: number; chainId?: number }) {
  const { t } = useI18n();
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">{t("dashboard.inventory.token", { id: tokenId })}</h2>
        <TokenTxHash tokenId={tokenId} chainId={chainId} />
      </div>
    </div>
  );
}
