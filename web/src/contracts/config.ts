export const CONTRACT_CONFIG = {
  address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
  adminAddress: process.env.NEXT_PUBLIC_ADMIN_ADDRESS as `0x${string}`,
} as const;
