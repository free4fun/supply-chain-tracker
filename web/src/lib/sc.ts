// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { getContract } from "@/lib/web3";
import type { Provider, EventLog } from "ethers";

export type UserView = { id: number; addr: string; role: string; status: number };
export type RoleReq = { user: string; role: string; blockNumber: number; txHash: string; timestamp?: number };
export async function scAdmin(): Promise<string> {
  const sc = await getContract(false);
  return sc.admin();
}

export async function getUserInfo(addr: string) {
  const sc = await getContract(false);
  return sc.getUserInfo(addr);
}

export async function requestUserRole(role: string): Promise<void> {
  if (!role) throw new Error("Role required");
  const sc = await getContract(true);
  const tx = await sc.requestUserRole(role);
  await tx.wait();
}

export async function changeStatusUser(addr: string, newStatus: number): Promise<void> {
  const sc = await getContract(true);
  const tx = await sc.changeStatusUser(addr, newStatus);
  await tx.wait();
}

export async function createToken(
  name: string,
  description: string,
  totalSupply: bigint,
  features: string
): Promise<void> {
  if (!name) throw new Error("Name required");
  if (totalSupply <= BigInt(0)) throw new Error("Supply must be > 0"); // <- sin 0n
  const sc = await getContract(true);
  const tx = await sc.createToken(name, description, totalSupply, features);
  await tx.wait();
}

export async function getTokenView(id: number) {
  const sc = await getContract(false);
  return sc.getTokenView(id);
}

export async function nextTokenId(): Promise<number> {
  const sc = await getContract(false);
  const n: bigint = await sc.nextTokenId();
  return Number(n);
}

export async function getSuggestedParent(addr: string) {
  const sc = await getContract(false);
  return sc.getSuggestedParent(addr);
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

export async function getTransfer(id: number) {
  const sc = await getContract(false);
  return sc.getTransfer(id);
}

export async function getUserTokens(addr: string) {
  const sc = await getContract(false);
  return sc.getUserTokens(addr);
}

export async function getUserTransfers(addr: string) {
  const sc = await getContract(false);
  return sc.getUserTransfers(addr);
}

export async function getTokenBalance(tokenId: number, addr: string) {
  const sc = await getContract(false);
  return sc.getTokenBalance(tokenId, addr);
}

export async function nextUserId(): Promise<number> {
  const sc = await getContract(false);
  const n: bigint = await sc.nextUserId();
  return Number(n);
}

export async function getUserById(id: number): Promise<UserView> {
  const sc = await getContract(false);
  const u = await sc.users(id);
  return { id: Number(u[0]), addr: u[1], role: u[2], status: Number(u[3]) };
}

export async function listUsers(): Promise<UserView[]> {
  const sc = await getContract(false);
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