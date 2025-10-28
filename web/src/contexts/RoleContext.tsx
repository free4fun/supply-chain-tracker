"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { EventLog, Provider } from "ethers";

import { useWeb3 } from "@/contexts/Web3Context";
import { scAdmin, getUserInfo } from "@/lib/sc";
import { getContract } from "@/lib/web3";

const STATUS_LABELS = ["Pending", "Approved", "Rejected", "Canceled"] as const;

type Snapshot = {
  role?: string;
  status?: number;
  statusLabel?: string;
  isRegistered: boolean;
  isApproved: boolean;
  activeRole?: string;
  pendingRole?: string;
  company?: string;
  firstName?: string;
  lastName?: string;
  lastRequestedRole?: string;
  lastRequestedAt?: number;
  isAdmin: boolean;
};

type RoleContextValue = Snapshot & {
  loading: boolean;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
};

const RoleCtx = createContext<RoleContextValue | null>(null);

type EventfulProvider = Provider & {
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  off?: (event: string, listener: (...args: unknown[]) => void) => void;
};

async function readLastRequest(account: string): Promise<{
  role?: string;
  timestamp?: number;
}> {
  try {
    const sc = await getContract(false);
    const filter = sc.filters.UserRoleRequested(account);
    const logs = (await sc.queryFilter(filter, 0n, "latest")) as EventLog[];
    const last = logs.at(-1);
    if (!last) return {};

    const role = last.args?.[1] ? String(last.args[1]) : undefined;
    const provider = sc.runner?.provider as Provider | undefined;
    let timestamp: number | undefined;
    if (provider && last.blockNumber) {
      try {
        const block = await provider.getBlock(last.blockNumber);
        timestamp = block?.timestamp ? Number(block.timestamp) : undefined;
      } catch {
        timestamp = undefined;
      }
    }
    return { role, timestamp };
  } catch {
    return {};
  }
}

function emptySnapshot(isAdmin: boolean): Snapshot {
  return {
    role: undefined,
    status: undefined,
    statusLabel: undefined,
    isRegistered: false,
    isApproved: false,
    activeRole: undefined,
    lastRequestedRole: undefined,
    lastRequestedAt: undefined,
    isAdmin,
  };
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const { account, chainId } = useWeb3();
  const [adminAddr, setAdminAddr] = useState<string>("");
  const [snapshot, setSnapshot] = useState<Snapshot>(() => emptySnapshot(false));
  const [loading, setLoading] = useState<boolean>(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    scAdmin()
      .then(addr => {
        if (!addr) return;
        setAdminAddr(addr.toLowerCase());
      })
      .catch(() => {
        setAdminAddr("");
      });
  }, []);

  const buildSnapshot = useCallback(async (): Promise<Snapshot> => {
    const currentAdmin = adminAddr;
    if (!account) {
      return emptySnapshot(false);
    }

    const lowerAccount = account.toLowerCase();
    let role: string | undefined;
    let status: number | undefined;
    let isRegistered = false;
    let isApproved = false;
    let pendingRole: string | undefined;
    let company: string | undefined;
    let firstName: string | undefined;
    let lastName: string | undefined;

    try {
      const info = await getUserInfo(account);
      // getUserInfo returns tuple: [id, userAddress, role, pendingRole, status, company, firstName, lastName]
      role = String(info[2]);
      pendingRole = String(info[3] || "");
      status = Number(info[4]);
      company = info[5] ? String(info[5]) : undefined;
      firstName = info[6] ? String(info[6]) : undefined;
      lastName = info[7] ? String(info[7]) : undefined;
      isRegistered = true;
      isApproved = status === 1;
    } catch {
      role = undefined;
      status = undefined;
      isRegistered = false;
      isApproved = false;
    }

    const statusLabel =
      typeof status === "number" && status >= 0 && status < STATUS_LABELS.length
        ? STATUS_LABELS[status as 0 | 1 | 2 | 3]
        : status !== undefined
          ? `#${status}`
          : undefined;

    const { role: lastRoleEvt, timestamp } = await readLastRequest(account);
    // Prefer on-chain pendingRole if present; fallback to last event for display
    const lastRole = pendingRole && pendingRole.length > 0 ? pendingRole : lastRoleEvt;

    return {
      role,
      status,
      statusLabel,
      isRegistered,
      isApproved,
      activeRole: isApproved ? role : undefined,
      pendingRole,
      company,
      firstName,
      lastName,
      lastRequestedRole: lastRole,
      lastRequestedAt: timestamp,
      isAdmin: currentAdmin ? lowerAccount === currentAdmin : false,
    };
  }, [account, adminAddr]);

  const refresh = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!account) {
        if (!silent) setLoading(false);
        if (mountedRef.current) setSnapshot(emptySnapshot(false));
        return;
      }

      if (!silent) setLoading(true);
      try {
        const snap = await buildSnapshot();
        if (mountedRef.current) setSnapshot(snap);
      } catch {
        if (mountedRef.current) setSnapshot(emptySnapshot(false));
      } finally {
        if (!silent && mountedRef.current) setLoading(false);
      }
    },
    [account, buildSnapshot]
  );

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    refresh();

    if (!account)
      return () => {
        unsubs.forEach(fn => fn());
      };

    (async () => {
      try {
        const sc = await getContract(false);
        const handle = () => refresh({ silent: true });
        const roleFilter = sc.filters.UserRoleRequested(account);
        const statusFilter = sc.filters.UserStatusChanged(account);
        sc.on(roleFilter, handle);
        sc.on(statusFilter, handle);
        unsubs.push(() => sc.off(roleFilter, handle));
        unsubs.push(() => sc.off(statusFilter, handle));

        const provider = sc.runner?.provider as EventfulProvider | undefined;
        if (provider?.on && provider?.off) {
          const blockHandler = () => refresh({ silent: true });
          provider.on("block", blockHandler);
          unsubs.push(() => provider.off("block", blockHandler));
        }
      } catch (err: unknown) {
        console.error(err);
      }
    })();

    return () => {
      unsubs.forEach(fn => fn());
    };
  }, [account, chainId, refresh]);

  useEffect(() => {
    if (!adminAddr) return;
    refresh({ silent: true }).catch(() => {});
  }, [adminAddr, refresh]);

  const value = useMemo<RoleContextValue>(
    () => ({
      ...snapshot,
      loading,
      refresh,
    }),
    [snapshot, loading, refresh]
  );

  return <RoleCtx.Provider value={value}>{children}</RoleCtx.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleCtx);
  if (!ctx) throw new Error("RoleContext missing");
  return ctx;
}

