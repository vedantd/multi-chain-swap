/**
 * Quote Service
 *
 * Fetches, validates, and selects the best quotes from Relay, deBridge, and Jupiter.
 * Public API: getQuotes, NeedSolForGasError, and quote math/eligibility/selection helpers.
 */

import type { Connection } from "@solana/web3.js";
import type { NormalizedQuote, QuotesResult, SwapParams } from "@/types/swap";
import { CHAIN_ID_SOLANA } from "@/lib/chainConfig";
import { getDebridgeQuote } from "@/lib/debridge";
import { getJupiterQuote } from "@/lib/jupiter";
import { getRelayQuote, validateRelayRoute } from "@/lib/relay";
import { logQuoteEvaluation, type QuoteEvaluationMeta } from "../logging/quoteLogger";
import { filterEligibleQuotes } from "./eligibility";
import { detectTieBreaker, getReasonChosen, sortByBest } from "./selection";

export { validateSponsorProfitability } from "./eligibility";
export {
  costToUserRaw,
  effectiveReceiveRaw,
  hasEnoughSolForQuote,
  minSolRequiredForQuote,
  netUserValueUsd,
} from "./quoteMath";
export { sortByBest } from "./selection";

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

export async function getQuotes(
  params: SwapParams,
  connection?: Connection,
  userSOLBalance?: string,
  userSolanaUSDCBalance?: string
): Promise<QuotesResult> {
  const isSameChain = params.originChainId === params.destinationChainId;
  const isSameChainSolana = isSameChain && params.originChainId === CHAIN_ID_SOLANA;

  if (!isSameChainSolana) {
    try {
      const routeValidation = await validateRelayRoute(
        params.originChainId,
        params.originToken,
        params.destinationChainId,
        params.destinationToken
      );
      if (!routeValidation.isSupported) {
        const reason =
          routeValidation.reason ??
          "This route is not supported. Try a different token pair or chain.";
        console.error("[quoteService] Route validation failed:", reason);
        throw new Error(reason);
      }
    } catch (err) {
      console.error("[quoteService] Route validation error:", err);
      throw err;
    }
  }

  const askDebridge = !isSameChain;
  const askRelay = !isSameChainSolana;
  const relayBalanceOverrides =
    userSOLBalance != null
      ? { userSOLBalance, userSolanaUSDCBalance: userSolanaUSDCBalance }
      : undefined;

  const providerPromises: Array<{ provider: "relay" | "debridge" | "jupiter"; promise: Promise<NormalizedQuote> }> = [];
  if (askRelay) {
    providerPromises.push({
      provider: "relay",
      promise: getRelayQuote(params, connection, relayBalanceOverrides),
    });
  }
  if (askDebridge) {
    providerPromises.push({ provider: "debridge", promise: getDebridgeQuote(params) });
  }
  if (isSameChainSolana) {
    providerPromises.push({ provider: "jupiter", promise: getJupiterQuote(params) });
  }

  const promises = providerPromises.map((p) => p.promise);
  const results = await Promise.allSettled(promises);

  const relayIndex = providerPromises.findIndex((p) => p.provider === "relay");
  const debridgeIndex = providerPromises.findIndex((p) => p.provider === "debridge");
  const jupiterIndex = providerPromises.findIndex((p) => p.provider === "jupiter");
  const relayResult = relayIndex >= 0 ? results[relayIndex] : undefined;
  const debridgeResult = debridgeIndex >= 0 ? results[debridgeIndex] : undefined;
  const jupiterResult = jupiterIndex >= 0 ? results[jupiterIndex] : undefined;

  const quotes: NormalizedQuote[] = [];
  if (relayResult?.status === "fulfilled") quotes.push(relayResult.value);
  else if (relayResult?.status === "rejected") {
    const reason = (relayResult as PromiseRejectedResult).reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    console.error("[quoteService] Relay quote failed:", message, stack ? { stack } : "");
  }
  if (debridgeResult?.status === "fulfilled") quotes.push(debridgeResult.value);
  else if (debridgeResult?.status === "rejected") console.error("[quoteService] deBridge quote failed:", debridgeResult.reason);
  if (jupiterResult?.status === "fulfilled") quotes.push(jupiterResult.value);
  else if (jupiterResult?.status === "rejected") console.error("[quoteService] Jupiter quote failed:", jupiterResult.reason);

  if (quotes.length === 0) {
    const errors = [
      askRelay && relayResult?.status === "rejected" ? (relayResult as PromiseRejectedResult).reason?.message : null,
      askDebridge && debridgeResult?.status === "rejected" ? (debridgeResult as PromiseRejectedResult).reason?.message : null,
      isSameChainSolana && jupiterResult?.status === "rejected" ? (jupiterResult as PromiseRejectedResult).reason?.message : null,
    ].filter(Boolean);
    console.error("[quoteService] No quotes available:", { askRelay, askDebridge, isSameChainSolana, errors });
    throw new Error(
      errors.length > 0 ? `No quotes available: ${errors.join("; ")}` : "No quotes available from any provider"
    );
  }

  const { eligibleQuotes, rejections } = await filterEligibleQuotes(quotes, params, connection, userSOLBalance);

  if (eligibleQuotes.length === 0) {
    const solRejection = rejections.find((r) => /Insufficient SOL balance/i.test(r.reason));
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

  return { quotes: sorted, best };
}
