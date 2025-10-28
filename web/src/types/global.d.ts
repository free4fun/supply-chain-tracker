export {};

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      addEventListener?: (ev: "accountsChanged" | "chainChanged", cb: (...a: any[]) => void) => void;
      removeEventListener?: (ev: "accountsChanged" | "chainChanged", cb: (...a: any[]) => void) => void;
    };
  }
}
