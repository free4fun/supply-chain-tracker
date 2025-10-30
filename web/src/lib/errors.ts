// SPDX-License-Identifier: AGPL-3.0-only
// Error handling utilities for user-initiated transaction cancellations

/**
 * Check if an error represents a user cancellation/rejection of a transaction.
 * MetaMask and other wallets throw specific errors when users deny transactions.
 */
export function isUserRejection(err: unknown): boolean {
  if (!err) return false;
  
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  
  // Check for ethers v6 error code
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as any).code;
    if (code === 'ACTION_REJECTED' || code === 4001) {
      return true;
    }
  }
  
  // Common rejection patterns from MetaMask and other wallets
  return (
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('user cancelled') ||
    message.includes('user canceled') ||
    message.includes('transaction was rejected') ||
    message.includes('rejected by user') ||
    message.includes('denied transaction') ||
    message.includes('action_rejected') ||
    message.includes('user disapproved') ||
    message.includes('ethers-user-denied')
  );
}

/**
 * Get a user-friendly error message, returning null if it's a user rejection
 * (so the UI can silently ignore it without showing an error toast).
 */
export function getErrorMessage(err: unknown, fallback: string): string | null {
  if (isUserRejection(err)) {
    return null; // Silent for user rejections
  }
  
  return err instanceof Error ? err.message : fallback;
}
