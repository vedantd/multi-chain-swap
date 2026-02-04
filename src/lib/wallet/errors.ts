import type { WalletError } from "@solana/wallet-adapter-base";
import {
  WalletConnectionError,
  WalletWindowClosedError,
  WalletWindowBlockedError,
  WalletTimeoutError,
  WalletNotReadyError,
  WalletLoadError,
  WalletDisconnectedError,
  WalletDisconnectionError,
} from "@solana/wallet-adapter-base";

/**
 * Map adapter WalletError to a short, user-friendly message.
 * Keeps raw error for logging; returns message safe to show in UI.
 */
export function getWalletErrorMessage(error: WalletError): string {
  if (error instanceof WalletWindowClosedError) {
    return "Connection cancelled. Please try again when ready.";
  }
  if (error instanceof WalletWindowBlockedError) {
    return "Popup was blocked. Please allow popups and try again.";
  }
  if (error instanceof WalletTimeoutError) {
    return "Connection timed out. Please try again.";
  }
  if (error instanceof WalletNotReadyError) {
    return "Wallet isn't ready yet. Refresh the page and try again.";
  }
  if (error instanceof WalletLoadError) {
    return "Failed to load wallet. Try refreshing or another wallet.";
  }
  if (error instanceof WalletConnectionError) {
    return "Connection failed. Please try again or use another wallet.";
  }
  if (error instanceof WalletDisconnectedError || error instanceof WalletDisconnectionError) {
    return "You were disconnected. Connect again to continue.";
  }
  if (error.message && error.message.trim().length > 0) {
    return error.message.trim();
  }
  return "Something went wrong. Please try again.";
}

/**
 * Wallet and transaction error handling utilities.
 * Provides user-friendly error messages for common transaction errors.
 */

export interface ErrorContext {
  transactionType?: "swap" | "approval" | "deposit";
  provider?: "relay" | "debridge" | "jupiter";
}

/**
 * Get a user-friendly error message from an error object.
 * 
 * @param error - The error object or message
 * @param context - Optional context about the error
 * @returns User-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown, context?: ErrorContext): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("connection") ||
      message.includes("timeout")
    ) {
      return "Network error. Please check your connection and try again.";
    }
    
    // Insufficient balance errors
    if (
      message.includes("insufficient") ||
      message.includes("balance") ||
      message.includes("lamports")
    ) {
      return "Insufficient balance. Please ensure you have enough funds to complete this transaction.";
    }
    
    // User rejection
    if (
      message.includes("user rejected") ||
      message.includes("user denied") ||
      message.includes("cancelled") ||
      message.includes("canceled")
    ) {
      return "Transaction cancelled by user.";
    }
    
    // Transaction timeout
    if (
      message.includes("timeout") ||
      message.includes("expired") ||
      message.includes("stale")
    ) {
      return "Transaction timed out. Please try again.";
    }
    
    // Quote errors
    if (message.includes("quote") || message.includes("no route")) {
      return "Unable to get quote for this swap. Please try a different amount or destination.";
    }
    
    // Validation errors
    if (
      message.includes("invalid") ||
      message.includes("validation") ||
      message.includes("required")
    ) {
      return "Invalid transaction parameters. Please check your inputs and try again.";
    }
    
    // Return original message if no specific pattern matches
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
}

/**
 * Check if an error is retryable (network errors, timeouts).
 * 
 * @param error - The error to check
 * @returns True if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (typeof error === "string") {
    const msg = error.toLowerCase();
    return (
      msg.includes("network") ||
      msg.includes("timeout") ||
      msg.includes("connection") ||
      msg.includes("fetch")
    );
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("network") ||
      msg.includes("timeout") ||
      msg.includes("connection") ||
      msg.includes("fetch")
    );
  }

  return false;
}

/**
 * Retry wrapper with exponential backoff.
 * 
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param initialDelayMs - Initial delay in milliseconds (default: 1000)
 * @returns Result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if it's the last attempt or error is not retryable
      if (i === maxRetries - 1 || !isRetryableError(error)) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = initialDelayMs * Math.pow(2, i);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  
  throw lastError ?? new Error("Max retries exceeded");
}
