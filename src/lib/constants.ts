/**
 * Centralized application constants.
 * All shared constants should be defined here to avoid duplication and ensure consistency.
 */

// ============================================================================
// Quote Configuration
// ============================================================================

/**
 * Quote validity duration in milliseconds.
 * Quotes from providers are considered valid for this duration after being fetched.
 * Used to determine when quotes expire and need to be refreshed.
 */
export const QUOTE_VALIDITY_MS = 30_000; // 30 seconds

/**
 * Debounce delay in milliseconds for quote fetching.
 * Waits for user to stop typing before fetching quotes to avoid excessive API calls.
 */
export const QUOTE_DEBOUNCE_MS = 600; // 600ms

/**
 * Quote staleness threshold in milliseconds for UX purposes.
 * After this duration of user inactivity, prompt user to fetch a new quote.
 */
export const QUOTE_STALE_MS = 20_000; // 20 seconds

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Cache duration in milliseconds for SOL price data.
 * SOL price is cached to reduce API calls to CoinGecko.
 */
export const SOL_PRICE_CACHE_MS = 60_000; // 1 minute

/**
 * Cache duration in milliseconds for token price data.
 * Token prices are cached to reduce API calls to CoinGecko.
 */
export const TOKEN_PRICE_CACHE_MS = 60_000; // 1 minute

/**
 * Cache duration in milliseconds for supported tokens list.
 * Token lists from Relay and deBridge are cached to reduce API calls.
 */
export const SUPPORTED_TOKENS_CACHE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Stale time in milliseconds for React Query cache.
 * Used for supported tokens hook to determine when data is considered stale.
 */
export const SUPPORTED_TOKENS_STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Token Addresses
// ============================================================================

/**
 * USDC mint address on Solana.
 * Used for token balance checks and default token selection.
 */
export const USDC_MINT_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// ============================================================================
// Relay Configuration
// ============================================================================

/**
 * Default deposit fee payer address for Relay sponsorship.
 * This address pays for Solana transaction fees when gasless transactions are enabled.
 * Can be overridden via environment variable RELAY_DEPOSIT_FEE_PAYER or SPONSOR_SOLANA_ADDRESS.
 */
export const DEFAULT_DEPOSIT_FEE_PAYER = "Av29j1oEbWAt77AzXyTA2fAzRnHytfG3mEV8kYm5E83M";
