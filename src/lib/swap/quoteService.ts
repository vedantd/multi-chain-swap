import type { NormalizedQuote, QuotesResult, SwapParams } from "@/types/swap";
import { getRelayQuote } from "@/lib/relay/quote";
import { getDebridgeQuote } from "@/lib/debridge/quote";
import { logQuoteEvaluation } from "./quoteAccounting";

/**
 * Fetches quotes from Relay and deBridge in parallel. Chain IDs are mapped per provider:
 * - Relay uses 792703809 for Solana (SVM); deBridge uses 7565164. See chainConfig toRelayChainId / toDebridgeChainId.
 */
export async function getQuotes(params: SwapParams): Promise<QuotesResult> {
  const recipient = params.recipientAddress ?? params.userAddress;
  console.log("[quoteService] Fetching quotes for", { originChainId: params.originChainId, destinationChainId: params.destinationChainId, destinationAddress: recipient });

  const [debridgeResult, relayResult] = await Promise.allSettled([
    getDebridgeQuote(params),
    getRelayQuote(params),
  ]);

  console.log("[quoteService] Relay result:", relayResult.status, relayResult.status === "rejected" ? (relayResult as PromiseRejectedResult).reason?.message : "ok");
  console.log("[quoteService] deBridge result:", debridgeResult.status, debridgeResult.status === "rejected" ? (debridgeResult as PromiseRejectedResult).reason?.message : "ok");

  const quotes: NormalizedQuote[] = [];

  if (relayResult.status === "fulfilled") {
    quotes.push(relayResult.value);
  }
  if (debridgeResult.status === "fulfilled") {
    quotes.push(debridgeResult.value);
  }

  if (quotes.length === 0) {
    const errors = [
      relayResult.status === "rejected" ? (relayResult as PromiseRejectedResult).reason?.message : null,
      debridgeResult.status === "rejected" ? (debridgeResult as PromiseRejectedResult).reason?.message : null,
    ].filter(Boolean);
    throw new Error(
      errors.length > 0
        ? `No quotes available: ${errors.join("; ")}`
        : "No quotes available from any provider"
    );
  }

  const sorted = sortByBest(quotes, params);
  const best = sorted[0] ?? null;

  try {
    const tieBreakerInfo = detectTieBreaker(quotes, sorted, params);
    await logQuoteEvaluation(params, quotes, best, tieBreakerInfo);
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

  if (best.provider !== "relay" || second.provider !== "debridge") {
    return { tieBreakerApplied: false };
  }

  const bestEff = effectiveReceiveRaw(best);
  const secondEff = effectiveReceiveRaw(second);
  if (bestEff === BigInt(0)) {
    return { tieBreakerApplied: false };
  }

  const CLOSE_THRESHOLD_BPS = 10;
  const threshold = (bestEff * BigInt(CLOSE_THRESHOLD_BPS)) / BigInt(10000);
  const isClose = bestEff - secondEff <= threshold;

  if (isClose) {
    const originalSorted = [...originalQuotes].sort((a, b) => {
      const aEff = effectiveReceiveRaw(a);
      const bEff = effectiveReceiveRaw(b);
      if (aEff !== bEff) return aEff > bEff ? -1 : 1;
      const aOut = BigInt(a.expectedOut);
      const bOut = BigInt(b.expectedOut);
      if (aOut !== bOut) return aOut > bOut ? -1 : 1;
      return 0;
    });

    if (originalSorted[0]?.provider === "debridge" && originalSorted[1]?.provider === "relay") {
      return {
        tieBreakerApplied: true,
        thresholdUsed: String(threshold),
      };
    }
  }

  return { tieBreakerApplied: false };
}

/** Cost to user in output-token raw units. Engine treats Relay as sponsor-paid (0). */
export function costToUserRaw(q: NormalizedQuote): bigint {
  if (q.feePayer === "sponsor") return BigInt(0);
  return BigInt(q.fees);
}

/** Effective receive = expectedOut - costToUser (same currency only; solanaCostToUser is display-only). */
export function effectiveReceiveRaw(q: NormalizedQuote): bigint {
  const out = BigInt(q.expectedOut);
  const cost = costToUserRaw(q);
  return out > cost ? out - cost : BigInt(0);
}

/** Tie-breaker: prefer Relay when within this fraction of best (0.1%). */
const CLOSE_THRESHOLD_BPS = 10;

export function sortByBest(
  quotes: NormalizedQuote[],
  params: SwapParams
): NormalizedQuote[] {
  const sorted = [...quotes].sort((a, b) => {
    if (params.tradeType === "exact_in") {
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
