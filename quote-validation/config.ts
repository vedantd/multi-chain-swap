/**
 * Quote validation run configuration.
 * Tune batch size and sleep to stay within 5–6 minutes and avoid rate limits.
 */

export const BATCH_SIZE = 10;
export const SLEEP_BETWEEN_BATCHES_MS = 10_000;
export const TARGET_TOTAL_CALLS = 150;


/** Path to JSONL log of past quote requests (seed for test cases). */
export const QUOTES_ACCOUNTING_PATH = "logs/quotes-accounting.jsonl";

/** Output directory for CSV (created if missing). */
export const OUTPUT_DIR = "quote-validation/output";

/** Simulated SOL balance (lamports) so eligibility checks pass. ~1 SOL. */
export const MOCK_USER_SOL_BALANCE = "1000000000";

/** Price sanity: max allowed input vs output USD difference (fraction). Stablecoins. */
export const PRICE_SANITY_TOLERANCE_STABLECOIN = 0.05;

/** Price sanity: max allowed implied rate drift for non-stablecoins (fraction). */
export const PRICE_SANITY_TOLERANCE_NON_STABLECOIN = 0.15;

/** CoinGecko simple price URL (optional; skip price sanity if not set or request fails). */
export const COINGECKO_SIMPLE_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price";
