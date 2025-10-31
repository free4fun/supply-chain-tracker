// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { getContract } from "@/lib/web3";
import type { Provider, EventLog } from "ethers";

// Force view calls to use the latest block tag to avoid BlockOutOfRange errors after chain resets/redeploys
const CALL_OPTS = { blockTag: "latest" as any };

export type UserView = {
  id: number;
  addr: string;
  role: string;
  pendingRole?: string;
  status: number;
  company?: string;
  firstName?: string;
  lastName?: string;
};
export type RoleReq = { user: string; role: string; blockNumber: number; txHash: string; timestamp?: number };

export async function scAdmin(): Promise<string> {
  const sc = await getContract(false);
  return sc.admin(CALL_OPTS);
}

export async function getUserInfo(addr: string) {
  const sc = await getContract(false);
  return sc.getUserInfo(addr, CALL_OPTS);
}

export async function requestUserRole(role: string): Promise<void> {
  if (!role) throw new Error("Role required");
  const sc = await getContract(true);
  const tx = await sc.requestUserRole(role);
  await tx.wait();
}

export async function registerAndRequestRole(company: string, firstName: string, lastName: string, role: string): Promise<void> {
  if (!company || !firstName || !lastName) throw new Error("Profile required");
  if (!role) throw new Error("Role required");
  const sc = await getContract(true);
  const tx = await sc.registerAndRequestRole(company, firstName, lastName, role);
  await tx.wait();
}

export async function changeStatusUser(addr: string, newStatus: number): Promise<void> {
  const sc = await getContract(true);
  const tx = await sc.changeStatusUser(addr, newStatus);
  await tx.wait();
}

export async function cancelRoleRequest(): Promise<void> {
  const sc = await getContract(true);
  const tx = await sc.cancelRoleRequest();
  await tx.wait();
}

export async function updateUserProfile(company: string, firstName: string, lastName: string): Promise<void> {
  if (!company || !firstName || !lastName) throw new Error("Profile required");
  const sc = await getContract(true);
  const tx = await sc.updateUserProfile(company, firstName, lastName);
  await tx.wait();
}

export type ComponentInput = { tokenId: bigint; amount: bigint };

export async function createToken(
  name: string,
  description: string,
  totalSupply: bigint,
  features: string,
  components: ComponentInput[]
): Promise<void> {
  if (!name) throw new Error("Name required");
  if (totalSupply <= BigInt(0)) throw new Error("Supply must be > 0"); // <- sin 0n
  const sc = await getContract(true);
  const ids = components.map(component => component.tokenId);
  const amounts = components.map(component => component.amount);
  const tx = await sc.createToken(name, description, totalSupply, features, ids, amounts);
  await tx.wait();
}

export async function getTokenView(id: number) {
  const sc = await getContract(false);
  return sc.getTokenView(id, CALL_OPTS);
}

export type TokenComponent = { tokenId: number; amount: bigint };

export async function getTokenInputs(tokenId: number): Promise<TokenComponent[]> {
  const sc = await getContract(false);
  const raw = await sc.getTokenInputs(tokenId, CALL_OPTS);
  return raw.map((entry: any) => ({
    tokenId: Number(entry.tokenId ?? entry[0]),
    amount: BigInt(entry.amount ?? entry[1]),
  }));
}

export async function nextTokenId(): Promise<number> {
  const sc = await getContract(false);
  const n: bigint = await sc.nextTokenId(CALL_OPTS);
  return Number(n);
}

export async function getSuggestedParent(addr: string) {
  const sc = await getContract(false);
  return sc.getSuggestedParent(addr, CALL_OPTS);
}

export async function transfer(to: string, tokenId: bigint, amount: bigint) {
  const sc = await getContract(true);
  const tx = await sc.transfer(to, tokenId, amount);
  await tx.wait();
}

export async function acceptTransfer(id: bigint) {
  const sc = await getContract(true);
  const tx = await sc.acceptTransfer(id);
  await tx.wait();
}

export async function rejectTransfer(id: bigint) {
  const sc = await getContract(true);
  const tx = await sc.rejectTransfer(id);
  await tx.wait();
}

export async function cancelTransfer(id: bigint) {
  const sc = await getContract(true);
  const tx = await sc.cancelTransfer(id);
  await tx.wait();
}

export async function getTransfer(id: number) {
  const sc = await getContract(false);
  return sc.getTransfer(id, CALL_OPTS);
}

export async function getUserTokens(addr: string) {
  const sc = await getContract(false);
  return sc.getUserTokens(addr, CALL_OPTS);
}

export async function getUserTransfers(addr: string) {
  const sc = await getContract(false);
  return sc.getUserTransfers(addr, CALL_OPTS);
}

export async function getTokenBalance(tokenId: number, addr: string) {
  const sc = await getContract(false);
  return sc.getTokenBalance(tokenId, addr, CALL_OPTS);
}

export async function getUserCreatedTokens(addr: string): Promise<number[]> {
  const sc = await getContract(false);
  const ids: bigint[] = await sc.getUserCreatedTokens(addr, CALL_OPTS);
  return ids.map(n => Number(n));
}

export type CreatedSummary = {
  createdCount: number;
  totalSupplySum: bigint;
  availableSum: bigint;
  totalConsumedInputs: bigint;
};

export async function getUserCreatedSummary(addr: string): Promise<CreatedSummary> {
  const sc = await getContract(false);
  const res = await sc.getUserCreatedSummary(addr, CALL_OPTS);
  // Expect tuple [createdCount, totalSupplySum, availableSum, totalConsumedInputs]
  return {
    createdCount: Number(res[0]),
    totalSupplySum: BigInt(res[1]),
    availableSum: BigInt(res[2]),
    totalConsumedInputs: BigInt(res[3]),
  };
}

export async function getUserBalancesNonZero(addr: string): Promise<{ ids: number[]; balances: bigint[] }> {
  const sc = await getContract(false);
  const [idsRaw, balancesRaw]: [bigint[], bigint[]] = await sc.getUserBalancesNonZero(addr, CALL_OPTS);
  return {
    ids: idsRaw.map(Number),
    balances: balancesRaw.map(BigInt),
  };
}

export async function nextUserId(): Promise<number> {
  const sc = await getContract(false);
  const n: bigint = await sc.nextUserId(CALL_OPTS);
  return Number(n);
}

export async function getUserById(id: number): Promise<UserView> {
  const sc = await getContract(false);
  const u = await sc.users(id, CALL_OPTS);
  // users mapping returns: [id, userAddress, role, pendingRole, status]
  return {
    id: Number(u[0]),
    addr: u[1],
    role: u[2],
    pendingRole: u[3],
    status: Number(u[4]),
    company: u[5],
    firstName: u[6],
    lastName: u[7],
  };
}

export async function listUsers(): Promise<UserView[]> {
  const n = await nextUserId();
  const out: UserView[] = [];
  for (let i = 1; i < n; i++) {
    try {
      const u = await getUserById(i);
      if (u.addr && u.addr !== "0x0000000000000000000000000000000000000000") out.push(u);
    } catch {}
  }
  return out;
}

export async function getAllRoleRequests(): Promise<RoleReq[]> {
  const sc = await getContract(false);
  const filter = sc.filters.UserRoleRequested();
  // Cast necesario: TS ve Log|EventLog, pero este filter retorna EventLog[]
  const logs = (await sc.queryFilter(filter, 0n, "latest")) as EventLog[];

  const provider = (sc.runner?.provider) as Provider;
  const reqs: RoleReq[] = [];
  for (const l of logs) {
    const user = (l.args?.[0] as string) || "";
    const role = (l.args?.[1] as string) || "";
    const bn = Number(l.blockNumber ?? 0n);
    let ts: number | undefined;
    if (l.blockNumber && provider) {
      const b = await provider.getBlock(l.blockNumber);
      ts = Number(b?.timestamp ?? 0);
    }
    reqs.push({ user, role, blockNumber: bn, txHash: l.transactionHash, timestamp: ts });
  }
  return reqs;
}

export async function lastRoleRequestByUser(): Promise<Record<string, RoleReq>> {
  // Reduce to last request per address (highest blockNumber)
  const all = await getAllRoleRequests();
  const idx: Record<string, RoleReq> = {};
  for (const r of all) {
    const key = r.user.toLowerCase();
    if (!idx[key] || r.blockNumber > (idx[key].blockNumber || 0)) idx[key] = r;
  }
  return idx;
}