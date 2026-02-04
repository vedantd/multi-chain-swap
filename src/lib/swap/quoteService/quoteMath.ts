/**
 * Pure quote math helpers: BigInt conversion, cost, effective receive, net USD value, min SOL.
 */

import type { NormalizedQuote } from "@/types/swap";

/**
 * Safely convert a value to BigInt, handling both string and number inputs.
 * Numbers in scientific notation are converted to fixed-point strings first.
 */
export function safeBigInt(value: string | number | undefined): bigint | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const cleaned = value.trim();
    if (!cleaned) return null;
    if (/[eE]/.test(cleaned)) {
      const num = Number(cleaned);
      if (!Number.isFinite(num)) return null;
      if (num >= Number.MAX_SAFE_INTEGER || num <= Number.MIN_SAFE_INTEGER) {
        console.warn("[quoteService] Value exceeds safe integer range:", cleaned);
        return null;
      }
      return BigInt(Math.floor(num).toString());
    }
    return BigInt(cleaned);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    if (value >= Number.MAX_SAFE_INTEGER || value <= Number.MIN_SAFE_INTEGER) {
      console.warn("[quoteService] Number exceeds safe integer range:", value);
      return null;
    }
    return BigInt(Math.floor(value).toString());
  }
  return null;
}

/**
 * Calculate the total cost to the user in raw token units.
 */
export function costToUserRaw(q: NormalizedQuote): bigint {
  if (q.feePayer === "sponsor") {
    if (q.userFeeCurrency === "SOL") return BigInt(0);
    return q.userFee ? safeBigInt(q.userFee) ?? BigInt(0) : BigInt(0);
  }
  if (
    q.userFeeCurrency != null &&
    q.feeCurrency != null &&
    q.userFeeCurrency !== q.feeCurrency
  ) {
    return BigInt(0);
  }
  return safeBigInt(q.fees) ?? BigInt(0);
}

/** Effective receive on destination chain = expectedOut - costToUser (in output units). */
export function effectiveReceiveRaw(q: NormalizedQuote): bigint {
  const out = BigInt(q.expectedOut);
  const cost = costToUserRaw(q);
  return out > cost ? out - cost : BigInt(0);
}

/** Net user value in USD for route comparison. */
export function netUserValueUsd(q: NormalizedQuote): number {
  const receives = q.userReceivesUsd ?? 0;
  const pays = q.userPaysUsd ?? 0;
  const solCost =
    q.requiresSOL && q.solanaCostToUser
      ? (Number(q.solanaCostToUser) / 1e9) * (q.solPriceUsd ?? 150)
      : 0;
  return receives - pays - solCost;
}

/**
 * Min SOL (lamports) required for a quote. Returns null if no SOL required.
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
  if (quote.provider === "jupiter" && quote.solanaCostToUser) {
    const cost = safeBigInt(quote.solanaCostToUser);
    if (cost == null) return null;
    return (cost * BigInt(110)) / BigInt(100);
  }
  return null;
}

export function hasEnoughSolForQuote(quote: NormalizedQuote, userSOLBalanceLamports: string): boolean {
  const required = minSolRequiredForQuote(quote);
  if (required == null) return true;
  return BigInt(userSOLBalanceLamports) >= required;
}
