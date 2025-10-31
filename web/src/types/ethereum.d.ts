type EIP1193RequestArgs = {
  method: string;
  params?: unknown[] | Record<string, unknown>;
};

interface EIP1193Provider {
  request: (args: EIP1193RequestArgs) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  off?: (event: string, listener: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}
export {};
