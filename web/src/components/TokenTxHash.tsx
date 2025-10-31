import React from 'react';
import { getTokenTxHash, formatTxHash, getExplorerUrl } from '@/lib/subgraph';

interface TokenTxHashProps {
  tokenId: number;
  chainId?: number;
  showFull?: boolean;
  variant?: 'default' | 'light'; // Para header con fondo oscuro
}

/**
 * Componente para mostrar el transaction hash de un token
 * Consulta automáticamente el subgraph y muestra el hash con link al explorer
 */
export function TokenTxHash({ tokenId, chainId = 31337, showFull = false, variant = 'default' }: TokenTxHashProps) {
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

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

  const isLight = variant === 'light';
  
  if (loading) {
    return (
      <span className={`text-xs animate-pulse ${isLight ? 'text-white/60' : 'text-slate-400'}`}>
        Cargando hash...
      </span>
    );
  }

  if (!txHash) {
    return (
      <span className={`text-xs italic ${isLight ? 'text-white/50' : 'text-slate-400'}`}>
        Hash no disponible
      </span>
    );
  }

  const displayHash = showFull ? txHash : formatTxHash(txHash);
  const explorerUrl = getExplorerUrl(txHash, chainId);

  return (
    <div className="inline-flex items-center gap-2">
      <span className={`text-xs font-mono ${isLight ? 'text-white/90' : 'text-slate-600 dark:text-slate-400'}`}>
        {displayHash}
      </span>
      {chainId !== 31337 && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs hover:opacity-80 transition-opacity ${
            isLight ? 'text-white' : 'text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300'
          }`}
          title="Ver en block explorer"
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
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Token #{tokenId}</h2>
        <TokenTxHash tokenId={tokenId} chainId={chainId} />
      </div>
    </div>
  );
}
