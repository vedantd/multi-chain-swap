import type { Connection } from "@solana/web3.js";

export type TransactionStatus = "pending" | "confirmed" | "finalized" | "failed";

export interface TransactionStatusResult {
  status: TransactionStatus;
  slot?: number;
  error?: unknown;
}

/**
 * Poll transaction status until it's finalized, confirmed, or failed.
 * 
 * @param connection - Solana connection
 * @param signature - Transaction signature to poll
 * @param maxAttempts - Maximum number of polling attempts (default: 30)
 * @param pollIntervalMs - Interval between polls in milliseconds (default: 1000)
 * @returns Transaction status result
 */
export async function pollTransactionStatus(
  connection: Connection,
  signature: string,
  maxAttempts: number = 30,
  pollIntervalMs: number = 1000
): Promise<TransactionStatusResult> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    
    try {
      const status = await connection.getSignatureStatus(signature);
      
      if (status?.value) {
        // Transaction confirmed or finalized
        if (status.value.confirmationStatus === "finalized") {
          return {
            status: "finalized",
            slot: status.value.slot ?? undefined,
          };
        }
        
        if (status.value.confirmationStatus === "confirmed") {
          return {
            status: "confirmed",
            slot: status.value.slot ?? undefined,
          };
        }
        
        // Transaction failed
        if (status.value.err) {
          return {
            status: "failed",
            slot: status.value.slot ?? undefined,
            error: status.value.err,
          };
        }
      }
    } catch (error) {
      // On error, continue polling (might be temporary network issue)
      console.warn(`[transactionStatus] Error polling transaction ${signature}:`, error);
    }
  }
  
  // Timeout - transaction not confirmed within max attempts
  return {
    status: "failed",
    error: new Error("Transaction polling timeout - transaction not confirmed within expected time"),
  };
}
