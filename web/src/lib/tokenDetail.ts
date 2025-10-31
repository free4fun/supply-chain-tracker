import { getTokenBalance, getTokenInputs, getTokenView } from "@/lib/sc";
import { handleBlockOutOfRange } from "@/lib/blockOutOfRange";

export type TokenDetail = {
  id: number;
  name: string;
  description: string;
  creator: string;
  totalSupply: bigint;
  availableSupply: bigint;
  parentId: number;
  createdAt: number;
  balance?: bigint;
  metadata: Record<string, unknown> | null;
  features: string;
};

export function parseMetadata(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getTokenDetail(tokenId: number, account?: string | null): Promise<TokenDetail> {
  let view: any;
  try {
    view = await getTokenView(tokenId);
  } catch (err) {
    handleBlockOutOfRange(err);
    throw err;
  }
  let balance: bigint | undefined = undefined;
  if (account) {
    try {
      const raw = await getTokenBalance(tokenId, account);
      balance = BigInt(raw);
    } catch (err) {
      handleBlockOutOfRange(err);
    }
  }
  const features = String(view[5]);
  return {
    id: Number(view[0]),
    creator: String(view[1]),
    name: String(view[2]),
    description: String(view[3] ?? ""),
    totalSupply: BigInt(view[4]),
    features,
    parentId: Number(view[6]),
    createdAt: Number(view[7]),
    availableSupply: BigInt(view[8] ?? 0n),
    balance,
    metadata: parseMetadata(features),
  };
}
