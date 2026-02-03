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
}

export type SwapProvider = "relay" | "debridge";

export interface NormalizedQuote {
  provider: SwapProvider;
  expectedOut: string;
  expectedOutFormatted: string;
  fees: string;
  feeCurrency: string;
  expiryAt: number;
  raw: unknown;
  timeEstimateSeconds?: number;
  slippageTolerance?: string;
}

export interface QuotesResult {
  quotes: NormalizedQuote[];
  best: NormalizedQuote | null;
}
