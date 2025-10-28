declare global {
  interface Window {
    ethereum?: any; // EIP-1193 provider (MetaMask, etc.)
  }
}
export {};
