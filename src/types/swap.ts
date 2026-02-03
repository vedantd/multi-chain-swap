/**
 * App-level normalized types for provider-agnostic cross-chain swap.
 * Relay and deBridge adapters map to/from these types.
 */

export type TradeType = "exact_in" | "exact_out";

export interface SwapParams {
  originChainId: number;
  originToken: string;
  amount: string;
  destinationChainId: number;
  destinationToken: string;
  userAddress: string;
  recipientAddress?: string;
  tradeType: TradeType;
  /** When set and origin is Solana, Relay uses this as the fee-paying address (e.g. connected wallet for demo). */
  depositFeePayer?: string;
}

export type SwapProvider = "relay" | "debridge";

export type FeePayer = "sponsor" | "user";

export interface NormalizedQuote {
  provider: SwapProvider;
  expectedOut: string;
  expectedOutFormatted: string;
  fees: string;
  feeCurrency: string;
  /** Who pays the bridge/protocol fee. Engine treats Relay as backend-sponsored (user pays 0). */
  feePayer: FeePayer;
  /** Raw amount the sponsor pays (same currency as feeCurrency). deBridge is "0". */
  sponsorCost: string;
  /** When origin is Solana and user pays (e.g. deBridge), estimated lamports for origin tx. */
  solanaCostToUser?: string;
  expiryAt: number;
  raw: unknown;
  timeEstimateSeconds?: number;
  slippageTolerance?: string;
}

export interface QuotesResult {
  quotes: NormalizedQuote[];
  best: NormalizedQuote | null;
}
