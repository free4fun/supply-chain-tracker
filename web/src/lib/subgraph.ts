/**
 * The Graph Subgraph integration
 * 
 * Proporciona funciones para consultar el subgraph y obtener
 * transaction hashes y otra información indexada.
 */

const SUBGRAPH_URL = 
  process.env.NEXT_PUBLIC_SUBGRAPH_URL || 
  'http://localhost:8000/subgraphs/name/supply-chain-tracker';

interface SubgraphToken {
  id: string;
  tokenId: string;
  name: string;
  description: string;
  creator: string;
  txHash: string;
  blockNumber: string;
  blockTimestamp: string;
  dateCreated: string;
  totalSupply: string;
  availableSupply: string;
  creatorCompany?: string;
  creatorRole?: string;
}

interface SubgraphTransfer {
  id: string;
  transferId: string;
  from: string;
  to: string;
  tokenId: string;
  amount: string;
  status: number;
  txHash: string;
  blockNumber: string;
  dateCreated: string;
}

/**
 * Ejecuta una query GraphQL en el subgraph
 */
async function querySubgraph<T>(query: string): Promise<T | null> {
  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      console.error('Subgraph query failed:', response.statusText);
      return null;
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('Subgraph errors:', data.errors);
      return null;
    }

    return data.data;
  } catch (error) {
    console.error('Error querying subgraph:', error);
    return null;
  }
}

/**
 * Obtiene el transaction hash de un token
 */
export async function getTokenTxHash(tokenId: number): Promise<string | null> {
  const query = `{
    token(id: "${tokenId}") {
      txHash
    }
  }`;

  const data = await querySubgraph<{ token: { txHash: string } | null }>(query);
  return data?.token?.txHash || null;
}

/**
 * Obtiene información completa de un token desde el subgraph
 */
export async function getTokenFromSubgraph(tokenId: number): Promise<SubgraphToken | null> {
  const query = `{
    token(id: "${tokenId}") {
      id
      tokenId
      name
      description
      creator
      txHash
      blockNumber
      blockTimestamp
      dateCreated
      totalSupply
      availableSupply
      creatorCompany
      creatorRole
    }
  }`;

  const data = await querySubgraph<{ token: SubgraphToken | null }>(query);
  return data?.token || null;
}

/**
 * Obtiene múltiples tokens con sus tx hashes
 */
export async function getTokensWithHashes(tokenIds: number[]): Promise<Map<number, string>> {
  const idsString = tokenIds.map(id => `"${id}"`).join(', ');
  const query = `{
    tokens(where: { id_in: [${idsString}] }) {
      id
      txHash
    }
  }`;

  const data = await querySubgraph<{ tokens: Array<{ id: string; txHash: string }> }>(query);
  
  const hashMap = new Map<number, string>();
  if (data?.tokens) {
    data.tokens.forEach(token => {
      hashMap.set(parseInt(token.id), token.txHash);
    });
  }
  
  return hashMap;
}

/**
 * Obtiene el transaction hash de una transferencia
 */
export async function getTransferTxHash(transferId: number): Promise<string | null> {
  const query = `{
    transfer(id: "${transferId}") {
      txHash
    }
  }`;

  const data = await querySubgraph<{ transfer: { txHash: string } | null }>(query);
  return data?.transfer?.txHash || null;
}

/**
 * Obtiene todos los tokens creados por un usuario
 */
export async function getUserTokens(userAddress: string): Promise<SubgraphToken[]> {
  const query = `{
    tokens(
      where: { creator: "${userAddress.toLowerCase()}" }
      orderBy: dateCreated
      orderDirection: desc
    ) {
      id
      tokenId
      name
      description
      txHash
      dateCreated
      totalSupply
      availableSupply
    }
  }`;

  const data = await querySubgraph<{ tokens: SubgraphToken[] }>(query);
  return data?.tokens || [];
}

/**
 * Obtiene los últimos tokens creados
 */
export async function getRecentTokens(limit: number = 10): Promise<SubgraphToken[]> {
  const query = `{
    tokens(
      first: ${limit}
      orderBy: dateCreated
      orderDirection: desc
    ) {
      id
      tokenId
      name
      description
      creator
      txHash
      dateCreated
      creatorCompany
      creatorRole
    }
  }`;

  const data = await querySubgraph<{ tokens: SubgraphToken[] }>(query);
  return data?.tokens || [];
}

/**
 * Formatea un tx hash para mostrar (versión corta)
 */
export function formatTxHash(hash: string, length: number = 10): string {
  if (hash.length <= length) return hash;
  return `${hash.slice(0, length)}...`;
}

/**
 * Genera el URL del block explorer para un tx hash
 */
export function getExplorerUrl(txHash: string, chainId: number = 31337): string {
  // Para local (31337), no hay explorer
  if (chainId === 31337) {
    return `#${txHash}`;
  }
  
  // Para Sepolia
  if (chainId === 11155111) {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }
  
  // Para Ethereum mainnet
  if (chainId === 1) {
    return `https://etherscan.io/tx/${txHash}`;
  }
  
  return `#${txHash}`;
}

/**
 * Hook para obtener tx hash de un token (con caché)
 */
export function useTokenTxHash(tokenId: number | null) {
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!tokenId) {
      setTxHash(null);
      return;
    }

    // Verificar caché en localStorage
    const cached = localStorage.getItem(`tx_hash_${tokenId}`);
    if (cached) {
      setTxHash(cached);
      return;
    }

    // Consultar subgraph
    setLoading(true);
    getTokenTxHash(tokenId)
      .then(hash => {
        if (hash) {
          setTxHash(hash);
          localStorage.setItem(`tx_hash_${tokenId}`, hash);
        }
      })
      .finally(() => setLoading(false));
  }, [tokenId]);

  return { txHash, loading };
}

// Re-exportar React si es necesario
import React from 'react';
