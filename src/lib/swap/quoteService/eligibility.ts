/**
 * Quote eligibility: check and filter quotes (e.g. sponsor profitability).
 */

import type { Connection } from "@solana/web3.js";
import type { NormalizedQuote, SwapParams } from "@/types/swap";

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export interface FilterEligibleResult {
  eligibleQuotes: NormalizedQuote[];
  rejections: Array<{ provider: string; reason: string }>;
}

/** Small tolerance (USD) so floating-point rounding does not reject valid Relay sponsor quotes. */
const RELAY_FEE_TOLERANCE_USD = 0.01;

async function checkEligibility(
  quote: NormalizedQuote,
  _params: SwapParams,
  _connection?: Connection,
  _userSOLBalance?: string
): Promise<EligibilityResult> {
  if (quote.provider === "relay" && quote.feePayer === "sponsor") {
    const userFeeUsd = quote.userFeeUsd ?? 0;
    const worstCaseUsd = quote.worstCaseSponsorCostUsd ?? 0;
    if (userFeeUsd < worstCaseUsd - RELAY_FEE_TOLERANCE_USD) {
      return {
        eligible: false,
        reason: `User fee (${userFeeUsd} USD) < worst-case cost (${worstCaseUsd} USD)`,
      };
    }
  }
  return { eligible: true };
}

export async function filterEligibleQuotes(
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
      console.warn(
        `[quoteService] Rejecting quote from ${quote.provider}:`,
        reason,
        quote.provider === "relay" ? { userFeeUsd: quote.userFeeUsd, worstCaseSponsorCostUsd: quote.worstCaseSponsorCostUsd } : ""
      );
    }
  }
  return { eligibleQuotes, rejections };
}

export function validateSponsorProfitability(quote: NormalizedQuote): { valid: boolean; reason?: string } {
  if (quote.provider !== "relay" || quote.feePayer !== "sponsor") {
    return { valid: true };
  }
  const userFeeUsd = quote.userFeeUsd ?? 0;
  const worstCaseUsd = quote.worstCaseSponsorCostUsd ?? 0;
  if (userFeeUsd < worstCaseUsd - RELAY_FEE_TOLERANCE_USD) {
    return {
      valid: false,
      reason: `User fee (${userFeeUsd} USD) does not cover worst-case costs (${worstCaseUsd} USD)`,
    };
  }
  return { valid: true };
}
