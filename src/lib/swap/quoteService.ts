/**
 * Quote Service
 * 
 * Core service for fetching, validating, and selecting the best quotes from multiple providers.
 * 
 * Responsibilities:
 * - Fetches quotes from Relay and deBridge providers in parallel
 * - Validates quote eligibility (sponsor profitability, route logic)
 * - Sorts quotes by best value for the user (net USD value, effective receive)
 * - Applies tie-breaker logic (prefer Relay when within 0.1% of deBridge)
 * - Logs quote evaluation for analytics and debugging
 * - Handles errors gracefully (NeedSolForGasError for insufficient SOL)
 * 
 * The service is provider-agnostic and works with normalized quote types.
 */

// External dependencies
import type { Connection } from "@solana/web3.js";

// Internal types
import type { NormalizedQuote, QuotesResult, SwapParams } from "@/types/swap";

// Internal utilities/lib functions
import { CHAIN_ID_SOLANA } from "@/lib/chainConfig";
import { getDebridgeQuote } from "@/lib/debridge/quote";
import { getRelayQuote } from "@/lib/relay/quote";
import { validateRelayRoute } from "@/lib/relay/routeValidation";
import { logQuoteEvaluation, type QuoteEvaluationMeta } from "./logging/quoteLogger";

/** Thrown when no quotes are eligible solely because user has insufficient SOL for gas. */
export class NeedSolForGasError extends Error {
  readonly code = "NEED_SOL_FOR_GAS";
  constructor(
    message: string = "You need SOL to pay for transaction gas. Add ~0.02 SOL to your wallet and try again.",
    public minLamports?: string
  ) {
    super(message);
    this.name = "NeedSolForGasError";
  }
}

/**
 * Safely convert a value to BigInt, handling both string and number inputs.
 * Numbers in scientific notation are converted to fixed-point strings first.
 */
function safeBigInt(value: string | number | undefined): bigint | null {
  if (value == null) return null;
  if (typeof value === "string") {
    // Remove any whitespace
    const cleaned = value.trim();
    if (!cleaned) return null;
    // Check if it's in scientific notation (contains 'e' or 'E')
    if (/[eE]/.test(cleaned)) {
      // Parse scientific notation to a regular number, then convert to string
      const num = Number(cleaned);
      if (!Number.isFinite(num)) return null;
      // Convert to string without scientific notation using toFixed
      // For very large numbers, we need to handle them carefully
      if (num >= Number.MAX_SAFE_INTEGER || num <= Number.MIN_SAFE_INTEGER) {
        // For numbers beyond safe integer range, we can't reliably convert
        // This shouldn't happen for lamports, but handle gracefully
        console.warn("[quoteService] Value exceeds safe integer range:", cleaned);
        return null;
      }
      return BigInt(Math.floor(num).toString());
    }
    return BigInt(cleaned);
  }
  if (typeof value === "number") {
    // Check if number is within safe integer range
    if (!Number.isFinite(value)) return null;
    if (value >= Number.MAX_SAFE_INTEGER || value <= Number.MIN_SAFE_INTEGER) {
      console.warn("[quoteService] Number exceeds safe integer range:", value);
      return null;
    }
    // Convert to integer string (lamports should always be integers)
    return BigInt(Math.floor(value).toString());
  }
  return null;
}

/**
 * How we decide if the user's SOL balance is enough:
 *
 * - deBridge (Solana origin): need at least quote.solanaCostToUser + 10% buffer (gas for origin tx).
 * - Relay when fee is in SOL (quote.requiresSOL, quote.userFee in lamports): need at least quote.userFee.
 *
 * Both amounts are in lamports. We compare: userSOLBalanceLamports >= requiredLamports.
 */
export function minSolRequiredForQuote(quote: NormalizedQuote): bigint | null {
  if (quote.provider === "debridge" && quote.solanaCostToUser) {
    const cost = safeBigInt(quote.solanaCostToUser);
    if (cost == null) return null;
    return (cost * BigInt(110)) / BigInt(100);
  }
  if (quote.provider === "relay" && quote.requiresSOL && quote.userFee) {
    return safeBigInt(quote.userFee);
  }
  return null;
}

/**
 * Check if user's SOL balance is sufficient for a quote.
 * 
 * @param quote - The normalized quote to check
 * @param userSOLBalanceLamports - User's SOL balance in lamports as a string
 * @returns True if user has enough SOL, false otherwise
 */
export function hasEnoughSolForQuote(quote: NormalizedQuote, userSOLBalanceLamports: string): boolean {
  const required = minSolRequiredForQuote(quote);
  if (required == null) return true;
  return BigInt(userSOLBalanceLamports) >= required;
}

/** Returns true if the route is illogical (same chain and same token — no actual swap). */
export function isIllogicalRoute(params: SwapParams): boolean {
  const sameChain = params.originChainId === params.destinationChainId;
  const sameToken =
    params.originToken.trim().toLowerCase() === params.destinationToken.trim().toLowerCase();
  return sameChain && sameToken;
}

/** Produces a clear reason why the best quote was chosen (for logging and JSONL). Defined before getQuotes so it is always in scope. */
function getReasonChosen(
  best: NormalizedQuote | null,
  sorted: NormalizedQuote[],
  tieBreaker: { tieBreakerApplied: boolean; thresholdUsed?: string }
): { code: string; human: string } {
  if (!best) {
    return { code: "none", human: "No quote chosen" };
  }
  const provider = best.provider;
  if (sorted.length === 1) {
    return {
      code: `single_quote_${provider}`,
      human: `Only quote available (${provider})`,
    };
  }
  if (tieBreaker.tieBreakerApplied) {
    return {
      code: "tie_breaker_prefer_relay",
      human: `Tie-breaker: prefer Relay when within 0.1% of deBridge (${provider} chosen)`,
    };
  }
  return {
    code: `highest_effective_receive_${provider}`,
    human: `Highest effective receive / net value (${provider} chosen)`,
  };
}

/**
 * Fetch quotes from Relay and deBridge providers and return the best option.
 * 
 * Chain IDs are mapped per provider:
 * - Relay uses 792703809 for Solana (SVM); deBridge uses 7565164.
 * - See chainConfig toRelayChainId / toDebridgeChainId for mapping details.
 * 
 * Behavior:
 * - Same-chain swaps (origin === destination): Relay only.
 * - Cross-chain: Relay and deBridge always queried.
 * - Quotes are shown regardless of user SOL balance; execution is blocked in UI when balance is insufficient.
 * - Route validation: Checks Relay Chains API before fetching quotes to prevent wasting user time.
 * 
 * IMPORTANT - Quote Freshness (Relay Best Practices):
 * - Quotes are revalidated when being filled - keep quotes as fresh as possible
 * - Always re-quote before execution (see SwapPanel.tsx handleExecute)
 * - Check quote expiry before execution
 * 
 * Preflight Checklist (from Relay docs):
 * ✅ Verify user balance - Checked before execution
 * ✅ Check chain support - Route validation before quote fetch
 * ✅ Validate quote - Re-quote and validate before execution
 * ✅ Handle errors - Comprehensive error handling throughout
 * ✅ Monitor progress - Bridge status monitoring via /intents/status
 * 
 * @param params - Swap parameters (chains, tokens, amounts, addresses)
 * @param connection - Optional Solana connection for balance checks
 * @param userSOLBalance - Optional user SOL balance in lamports (for Relay optimization)
 * @param userSolanaUSDCBalance - Optional user USDC balance on Solana (for Relay optimization)
 * @returns Promise resolving to quotes result with best quote selected
 * @throws NeedSolForGasError if no quotes eligible due to insufficient SOL
 * @throws Error if no quotes available from any provider or route not supported
 */
export async function getQuotes(
  params: SwapParams,
  connection?: Connection,
  userSOLBalance?: string,
  userSolanaUSDCBalance?: string
): Promise<QuotesResult> {
  if (isIllogicalRoute(params)) {
    throw new Error("Same token on same chain is not a valid swap. Choose a different destination token or chain.");
  }

  // Validate route before attempting to fetch quotes (prevents wasting user time)
  const routeValidation = await validateRelayRoute(
    params.originChainId,
    params.originToken,
    params.destinationChainId,
    params.destinationToken
  );

  if (!routeValidation.isSupported) {
    throw new Error(
      routeValidation.reason ??
        "This route is not supported. Try a different token pair or chain."
    );
  }

  const recipient = params.recipientAddress ?? params.userAddress;
  const isSameChain = params.originChainId === params.destinationChainId;
  const askDebridge = !isSameChain;
  console.log("[quoteService] Fetching quotes for", { originChainId: params.originChainId, destinationChainId: params.destinationChainId, destinationAddress: recipient, isSameChain, askDebridge });

  const relayBalanceOverrides =
    userSOLBalance != null
      ? {
          userSOLBalance,
          userSolanaUSDCBalance: userSolanaUSDCBalance,
        }
      : undefined;
  const promises: Promise<NormalizedQuote>[] = [
    getRelayQuote(params, connection, relayBalanceOverrides),
  ];
  if (askDebridge) {
    promises.push(getDebridgeQuote(params));
  }

  const results = await Promise.allSettled(promises);
  const relayResult = results[0]!;
  const debridgeResult = results[1];

  console.log("[quoteService] Relay result:", relayResult.status, relayResult.status === "rejected" ? (relayResult as PromiseRejectedResult).reason?.message : "ok");
  if (askDebridge) {
    console.log("[quoteService] deBridge result:", debridgeResult?.status ?? "n/a", debridgeResult?.status === "rejected" ? (debridgeResult as PromiseRejectedResult).reason?.message : "ok");
  }

  const quotes: NormalizedQuote[] = [];
  if (relayResult.status === "fulfilled") quotes.push(relayResult.value);
  if (debridgeResult?.status === "fulfilled") quotes.push(debridgeResult.value);

  if (quotes.length === 0) {
    const errors = [
      relayResult.status === "rejected" ? (relayResult as PromiseRejectedResult).reason?.message : null,
      askDebridge && debridgeResult?.status === "rejected" ? (debridgeResult as PromiseRejectedResult).reason?.message : null,
    ].filter(Boolean);
    throw new Error(
      errors.length > 0
        ? `No quotes available: ${errors.join("; ")}`
        : "No quotes available from any provider"
    );
  }

  // Filter quotes based on eligibility
  const { eligibleQuotes, rejections } = await filterEligibleQuotes(
    quotes,
    params,
    connection,
    userSOLBalance
  );

  if (eligibleQuotes.length === 0) {
    const solRejection = rejections.find((r) =>
      /Insufficient SOL balance/i.test(r.reason)
    );
    if (solRejection) {
      throw new NeedSolForGasError(
        "You need SOL to pay for transaction gas. Add ~0.02 SOL to your wallet and try again."
      );
    }
    throw new Error("No eligible quotes available");
  }

  const sorted = sortByBest(eligibleQuotes, params);
  const best = sorted[0] ?? null;

  try {
    const tieBreakerInfo = detectTieBreaker(quotes, sorted, params);
    const reasonChosen = getReasonChosen(best, sorted, tieBreakerInfo);
    const evaluation: QuoteEvaluationMeta = { ...tieBreakerInfo, reasonChosen };
    await logQuoteEvaluation(params, quotes, best, evaluation);
  } catch (err) {
    console.error("[quoteService] Failed to log quote evaluation:", err);
  }

  return {
    quotes: sorted,
    best,
  };
}

function detectTieBreaker(
  originalQuotes: NormalizedQuote[],
  sorted: NormalizedQuote[],
  params: SwapParams
): { tieBreakerApplied: boolean; thresholdUsed?: string } {
  if (sorted.length < 2 || params.tradeType !== "exact_in") {
    return { tieBreakerApplied: false };
  }

  const best = sorted[0];
  const second = sorted[1];
  if (best == null || second == null) {
    return { tieBreakerApplied: false };
  }

  // Tie-breaker: prefer Relay when within 0.1% of deBridge
  // If Relay is best and deBridge is second, check if tie-breaker was applied
  // (i.e., deBridge was originally better but Relay was promoted)
  if (best.provider !== "relay" || second.provider !== "debridge") {
    return { tieBreakerApplied: false };
  }

  // Check original order (by effective receive) to see if deBridge was originally better
  const originalSorted = [...originalQuotes].sort((a, b) => {
    const aEff = effectiveReceiveRaw(a);
    const bEff = effectiveReceiveRaw(b);
    if (aEff !== bEff) return aEff > bEff ? -1 : 1;
    const aOut = BigInt(a.expectedOut);
    const bOut = BigInt(b.expectedOut);
    if (aOut !== bOut) return aOut > bOut ? -1 : 1;
    return 0;
  });

  // If deBridge was originally better (first in originalSorted), tie-breaker was applied
  if (originalSorted[0]?.provider !== "debridge" || originalSorted[1]?.provider !== "relay") {
    return { tieBreakerApplied: false };
  }

  // Verify they're within threshold
  const bestEff = effectiveReceiveRaw(best);
  const secondEff = effectiveReceiveRaw(second);
  if (bestEff === BigInt(0)) {
    return { tieBreakerApplied: false };
  }

  const CLOSE_THRESHOLD_BPS = 10;
  const threshold = (secondEff * BigInt(CLOSE_THRESHOLD_BPS)) / BigInt(10000); // Use deBridge (second) as base since it was originally better
  const isClose = secondEff - bestEff <= threshold; // deBridge was better, check if Relay is within threshold

  if (isClose) {
    return {
      tieBreakerApplied: true,
      thresholdUsed: String(threshold),
    };
  }

  return { tieBreakerApplied: false };
}

/**
 * Cost to user in output-token raw units (for effective receive and comparison).
 * When Relay user pays in SOL, the fee is not deducted from destination output,
 * so cost in output units is 0. When user pays in USDC, same units as expectedOut.
 */
/**
 * Calculate the total cost to the user in raw token units.
 * Includes user fee and any SOL costs converted to fee currency.
 * 
 * @param q - The normalized quote
 * @returns Total cost in raw units (BigInt)
 */
export function costToUserRaw(q: NormalizedQuote): bigint {
  if (q.feePayer === "sponsor") {
    // Relay: user fee in SOL is paid on Solana, not from destination output
    if (q.userFeeCurrency === "SOL") return BigInt(0);
    return q.userFee ? safeBigInt(q.userFee) ?? BigInt(0) : BigInt(0);
  }
  // deBridge: user pays bridge fees (same currency as destination output)
  return safeBigInt(q.fees) ?? BigInt(0);
}

/** Effective receive on destination chain = expectedOut - costToUser (in output units). */
export function effectiveReceiveRaw(q: NormalizedQuote): bigint {
  const out = BigInt(q.expectedOut);
  const cost = costToUserRaw(q);
  return out > cost ? out - cost : BigInt(0);
}

/** Net user value in USD for route comparison. */
/**
 * Calculate the net USD value for the user (what they receive minus what they pay).
 * 
 * @param q - The normalized quote
 * @returns Net USD value (positive means user gains value)
 */
export function netUserValueUsd(q: NormalizedQuote): number {
  const receives = q.userReceivesUsd ?? 0;
  const pays = q.userPaysUsd ?? 0;
  const solCost =
    q.requiresSOL && q.solanaCostToUser
      ? (Number(q.solanaCostToUser) / 1e9) * (q.solPriceUsd ?? 150)
      : 0;
  return receives - pays - solCost;
}

/** Tie-breaker: prefer Relay when within this fraction of best (0.1%). */
const CLOSE_THRESHOLD_BPS = 10;

interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

async function checkEligibility(
  quote: NormalizedQuote,
  params: SwapParams,
  _connection?: Connection,
  _userSOLBalance?: string
): Promise<EligibilityResult> {
  // Show quotes regardless of user SOL balance; execution is blocked in the UI when balance is insufficient.

  // Relay routes: check solvency gate (quote validity — user fee must cover worst-case costs)
  if (quote.provider === "relay" && quote.feePayer === "sponsor") {
    const userFeeUsd = quote.userFeeUsd ?? 0;
    const worstCaseUsd = quote.worstCaseSponsorCostUsd ?? 0;
    if (userFeeUsd < worstCaseUsd) {
      return {
        eligible: false,
        reason: `User fee (${userFeeUsd} USD) < worst-case cost (${worstCaseUsd} USD)`,
      };
    }
  }

  return { eligible: true };
}

interface FilterEligibleResult {
  eligibleQuotes: NormalizedQuote[];
  rejections: Array<{ provider: string; reason: string }>;
}

async function filterEligibleQuotes(
  quotes: NormalizedQuote[],
  params: SwapParams,
  connection?: Connection,
  userSOLBalance?: string
): Promise<FilterEligibleResult> {
  const eligibleQuotes: NormalizedQuote[] = [];
  const rejections: Array<{ provider: string; reason: string }> = [];
  for (const quote of quotes) {
    const eligibility = await checkEligibility(quote, params, connection, userSOLBalance);
    if (eligibility.eligible) {
      eligibleQuotes.push(quote);
    } else {
      const reason = eligibility.reason ?? "Unknown";
      rejections.push({ provider: quote.provider, reason });
      console.warn(`[quoteService] Rejecting quote from ${quote.provider}:`, reason);
    }
  }
  return { eligibleQuotes, rejections };
}

export function validateSponsorProfitability(quote: NormalizedQuote): { valid: boolean; reason?: string } {
  // Only validate Relay routes (deBridge has no sponsor costs)
  if (quote.provider !== "relay" || quote.feePayer !== "sponsor") {
    return { valid: true };
  }

  const userFeeUsd = quote.userFeeUsd ?? 0;
  const worstCaseUsd = quote.worstCaseSponsorCostUsd ?? 0;

  // User fee must cover worst-case costs
  if (userFeeUsd < worstCaseUsd) {
    return {
      valid: false,
      reason: `User fee (${userFeeUsd} USD) does not cover worst-case costs (${worstCaseUsd} USD)`,
    };
  }

  return { valid: true };
}

/**
 * Sort quotes by best value for the user.
 * Considers net USD value, gasless preference, and other factors.
 * 
 * @param quotes - Array of normalized quotes to sort
 * @returns Sorted array with best quote first
 */
export function sortByBest(
  quotes: NormalizedQuote[],
  params: SwapParams
): NormalizedQuote[] {
  // Sort by net user value (USD) if available, otherwise fall back to effective receive
  const sorted = [...quotes].sort((a, b) => {
    if (params.tradeType === "exact_in") {
      // Try USD-based comparison first
      const aValueUsd = netUserValueUsd(a);
      const bValueUsd = netUserValueUsd(b);
      if (aValueUsd !== bValueUsd) {
        return bValueUsd > aValueUsd ? 1 : -1;
      }

      // Fallback to effective receive
      const aEff = effectiveReceiveRaw(a);
      const bEff = effectiveReceiveRaw(b);
      if (aEff !== bEff) return aEff > bEff ? -1 : 1;
      const aOut = BigInt(a.expectedOut);
      const bOut = BigInt(b.expectedOut);
      if (aOut !== bOut) return aOut > bOut ? -1 : 1;
      return 0;
    }
    const aCost = costToUserRaw(a);
    const bCost = costToUserRaw(b);
    if (aCost !== bCost) return aCost < bCost ? -1 : 1;
    return 0;
  });

  if (sorted.length < 2 || params.tradeType !== "exact_in") return sorted;

  const best = sorted[0];
  const second = sorted[1];
  if (best == null || second == null) return sorted;

  // Use USD-based comparison for tie-breaker if available
  const bestValueUsd = netUserValueUsd(best);
  const secondValueUsd = netUserValueUsd(second);
  
  if (bestValueUsd > 0 && secondValueUsd > 0) {
    const threshold = bestValueUsd * 0.001; // 0.1%
    const isClose = bestValueUsd - secondValueUsd <= threshold;
    if (isClose && best.provider === "debridge" && second.provider === "relay") {
      return [second, best, ...sorted.slice(2)];
    }
  }

  // Fallback to effective receive comparison
  const bestEff = effectiveReceiveRaw(best);
  if (bestEff === BigInt(0)) return sorted;

  const secondEff = effectiveReceiveRaw(second);
  const threshold = (bestEff * BigInt(CLOSE_THRESHOLD_BPS)) / BigInt(10000);
  const isClose = bestEff - secondEff <= threshold;

  if (isClose && best.provider === "debridge" && second.provider === "relay") {
    return [second, best, ...sorted.slice(2)];
  }
  return sorted;
}
