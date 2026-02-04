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
  /**
   * When set and origin is Solana, Relay uses this as the fee-paying address for deposit transactions.
   *
   * NOTE: Fee Sponsorship Requirements
   * Relay fee sponsorship (covering destination chain fees via `subsidizeFees` and `subsidizeRent`)
   * requires Enterprise Partnership. Until Enterprise Partnership is obtained, users must pay their
   * own Solana transaction fees, so this is typically set to the user's address.
   *
   * Once Enterprise Partnership is obtained:
   * - Can be set to sponsor address or omitted to use DEFAULT_DEPOSIT_FEE_PAYER
   * - Can use `subsidizeFees: true` and `subsidizeRent: true` in quote requests
   * - Requires `x-api-key` header with Enterprise API key
   *
   * See: https://docs.relay.link/features/fee-sponsorship
   */
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
  /** Bridge fees paid by sponsor (RECOUPED by Relay from user). */
  recoupedSponsorCost?: string;
  /** Worst-case non-recouped sponsor costs in USD (gas + rent + token-loss + drift + failure buffers). */
  worstCaseSponsorCostUsd?: number;
  /** User fee to cover non-recouped costs (in raw units). */
  userFee?: string;
  userFeeCurrency?: "USDC" | "SOL";
  userFeeUsd?: number; // USD value for comparison
  /** Route metadata for two execution lanes. */
  gasless?: boolean; // true for Relay (sponsor pays gas)
  requiresSOL?: boolean; // true if user needs SOL (deBridge or SOL fee fallback)
  /** USD values for route comparison. */
  userReceivesUsd?: number;
  userPaysUsd?: number;
  /** When origin is Solana and user pays (e.g. deBridge), estimated lamports for origin tx. */
  solanaCostToUser?: string;
  /** SOL price in USD (for SOL cost calculations). */
  solPriceUsd?: number;
  /** Price drift percentage (e.g., 0.02 for 2%) - accounts for quote volatility. Primarily for Relay quotes. */
  priceDrift?: number;
  /** Operating expense in raw units (when prependOperatingExpenses=true for deBridge). */
  operatingExpense?: string;
  expiryAt: number;
  raw: unknown;
  timeEstimateSeconds?: number;
  slippageTolerance?: string;
}

export interface QuotesResult {
  quotes: NormalizedQuote[];
  best: NormalizedQuote | null;
}

// ============================================================================
// UI Component Types
// ============================================================================

/**
 * Option for dropdown/select components.
 * Used in chain selection and other dropdown menus.
 */
export interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
}

/**
 * Option for token selection components.
 * Includes token address, symbol, and optional sublabel for display.
 */
export interface TokenOption {
  value: string;
  label: string;
  sublabel?: string;
}

// ============================================================================
// Quote Hook Types
// ============================================================================

/**
 * Balance information that can be provided when fetching quotes.
 * Allows the API to optimize quote selection based on user's available balances.
 */
export interface QuoteBalanceInput {
  userSOLBalance?: string;
  userSolanaUSDCBalance?: string;
}

/**
 * Function type for fetching balances dynamically at quote time.
 * Used to provide fresh balance data when quotes are requested.
 */
export type GetBalancesForQuote = () => Promise<QuoteBalanceInput | undefined>;
