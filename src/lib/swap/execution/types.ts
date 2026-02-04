/**
 * Shared types for swap execution (Relay, deBridge, Jupiter).
 */

import type { Connection } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { NormalizedQuote, SwapParams } from "@/types/swap";
import type { TransactionStatus } from "@/lib/solana/transactionStatus";

export interface ExecutionSetters {
  setTransactionStatus: (status: TransactionStatus | null) => void;
  setTransactionSignature: (sig: string | null) => void;
  setExecuteError: (error: string | null) => void;
  setExecuteSuccess: (success: string | null) => void;
  setSelectedQuote: (quote: NormalizedQuote | null) => void;
}

export interface ExecutionContext extends ExecutionSetters {
  connection: Connection;
  publicKey: { toBase58(): string } | null;
  sendTransaction: WalletContextState["sendTransaction"];
  signTransaction: WalletContextState["signTransaction"];
  /** Re-fetch quotes (for Relay re-quote before execute). */
  refetchQuotes: () => Promise<unknown>;
  /** Fetch fresh deBridge quote (for expiry refresh). */
  getDebridgeQuote: (params: SwapParams) => Promise<NormalizedQuote>;
  /** Connected Solana wallet name (e.g. "Phantom", "MetaMask") so deBridge uses the matching EVM provider. */
  walletName?: string;
}
