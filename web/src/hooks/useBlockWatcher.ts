"use client";

import { useEffect, useRef } from "react";

import { useWeb3 } from "@/contexts/Web3Context";

type Callback = () => void | Promise<void>;

export function useBlockWatcher(callback: Callback, deps: unknown[] = []) {
  const { getProvider } = useWeb3();
  const cbRef = useRef<Callback>(() => {});
  cbRef.current = callback;

  useEffect(() => {
    type WithBlockEvents = { on?: (event: string, listener: (...args: unknown[]) => void) => void; off?: (event: string, listener: (...args: unknown[]) => void) => void };
    let provider: (WithBlockEvents | undefined);
    let mounted = true;
    let running = false;
    let queued = false;

    const invoke = async () => {
      if (!mounted) return;
      if (running) {
        queued = true;
        return;
      }
      running = true;
      try {
        await cbRef.current();
      } catch (err: unknown) {
        console.error(err);
      } finally {
        running = false;
        if (queued) {
          queued = false;
          void invoke();
        }
      }
    };

    try {
      provider = getProvider?.();
    } catch {
      provider = undefined;
    }

    if (!provider?.on || !provider?.off) {
      return () => {
        mounted = false;
      };
    }

    const handler = () => {
      void invoke();
    };

    provider.on("block", handler);

    return () => {
      mounted = false;
      if (provider?.off) {
        provider.off("block", handler);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getProvider, ...deps]);
}

