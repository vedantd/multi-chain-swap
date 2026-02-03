import type { NormalizedQuote, QuotesResult, SwapParams } from "@/types/swap";
import { getRelayQuote } from "@/lib/relay/quote";
import { getDebridgeQuote } from "@/lib/debridge/quote";

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
  return {
    quotes: sorted,
    best: sorted[0] ?? null,
  };
}

function sortByBest(
  quotes: NormalizedQuote[],
  params: SwapParams
): NormalizedQuote[] {
  return [...quotes].sort((a, b) => {
    if (params.tradeType === "exact_in") {
      const aOut = BigInt(a.expectedOut);
      const bOut = BigInt(b.expectedOut);
      return aOut > bOut ? -1 : aOut < bOut ? 1 : 0;
    }
    const aFee = BigInt(a.fees);
    const bFee = BigInt(b.fees);
    return aFee < bFee ? -1 : aFee > bFee ? 1 : 0;
  });
}
