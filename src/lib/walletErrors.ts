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
    return "Wallet isn’t ready yet. Refresh the page and try again.";
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
