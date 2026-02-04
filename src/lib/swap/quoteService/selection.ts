/**
 * Quote selection: sort by best value, tie-breaker, reason for logging.
 */

import type { NormalizedQuote, SwapParams } from "@/types/swap";
import { CHAIN_ID_SOLANA } from "@/lib/chainConfig";
import {
  costToUserRaw,
  effectiveReceiveRaw,
  netUserValueUsd,
} from "./quoteMath";

const CLOSE_THRESHOLD_BPS = 10;

export function getReasonChosen(
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

export function detectTieBreaker(
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
  if (best.provider !== "relay" || second.provider !== "debridge") {
    return { tieBreakerApplied: false };
  }
  const originalSorted = [...originalQuotes].sort((a, b) => {
    const aEff = effectiveReceiveRaw(a);
    const bEff = effectiveReceiveRaw(b);
    if (aEff !== bEff) return aEff > bEff ? -1 : 1;
    const aOut = BigInt(a.expectedOut);
    const bOut = BigInt(b.expectedOut);
    if (aOut !== bOut) return aOut > bOut ? -1 : 1;
    return 0;
  });
  if (originalSorted[0]?.provider !== "debridge" || originalSorted[1]?.provider !== "relay") {
    return { tieBreakerApplied: false };
  }
  const bestEff = effectiveReceiveRaw(best);
  const secondEff = effectiveReceiveRaw(second);
  if (bestEff === BigInt(0)) {
    return { tieBreakerApplied: false };
  }
  const threshold = (secondEff * BigInt(CLOSE_THRESHOLD_BPS)) / BigInt(10000);
  const isClose = secondEff - bestEff <= threshold;
  if (isClose) {
    return {
      tieBreakerApplied: true,
      thresholdUsed: String(threshold),
    };
  }
  return { tieBreakerApplied: false };
}

/**
 * Sort quotes by best value for the user. Applies tie-breakers (prefer Relay when close, prefer Jupiter on same-chain Solana when close).
 */
export function sortByBest(quotes: NormalizedQuote[], params: SwapParams): NormalizedQuote[] {
  const sorted = [...quotes].sort((a, b) => {
    if (params.tradeType === "exact_in") {
      const aValueUsd = netUserValueUsd(a);
      const bValueUsd = netUserValueUsd(b);
      if (aValueUsd !== bValueUsd) {
        return bValueUsd > aValueUsd ? 1 : -1;
      }
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

  const isSameChainSolana =
    params.originChainId === CHAIN_ID_SOLANA &&
    params.destinationChainId === CHAIN_ID_SOLANA;
  const jupiterQuote = sorted.find((q) => q.provider === "jupiter");

  if (isSameChainSolana && jupiterQuote && best.provider !== "jupiter") {
    const bestValueUsd = netUserValueUsd(best);
    const jupiterValueUsd = netUserValueUsd(jupiterQuote);
    if (bestValueUsd > 0 && jupiterValueUsd > 0) {
      const threshold = bestValueUsd * 0.001;
      if (bestValueUsd - jupiterValueUsd <= threshold) {
        const rest = sorted.filter((q) => q !== jupiterQuote);
        return [jupiterQuote, ...rest];
      }
    }
    const bestEff = effectiveReceiveRaw(best);
    const jupiterEff = effectiveReceiveRaw(jupiterQuote);
    if (bestEff > BigInt(0) && jupiterEff > BigInt(0)) {
      const threshold = (bestEff * BigInt(CLOSE_THRESHOLD_BPS)) / BigInt(10000);
      if (bestEff - jupiterEff <= threshold) {
        const rest = sorted.filter((q) => q !== jupiterQuote);
        return [jupiterQuote, ...rest];
      }
    }
  }

  const bestValueUsd = netUserValueUsd(best);
  const secondValueUsd = netUserValueUsd(second);
  if (bestValueUsd > 0 && secondValueUsd > 0) {
    const threshold = bestValueUsd * 0.001;
    const isClose = bestValueUsd - secondValueUsd <= threshold;
    if (isClose && best.provider === "debridge" && second.provider === "relay") {
      return [second, best, ...sorted.slice(2)];
    }
  }

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
