// Internal types
import type { NormalizedQuote } from "@/types/swap";

// Internal utilities/lib functions
import { getTokenPriceUsd } from "@/lib/pricing";
import { netUserValueUsd } from "./quoteService";

export interface RouteQuote {
  provider: "relay" | "debridge";
  gasless: boolean;
  requiresSOL: boolean;
  userReceivesUsd: number;
  userPaysUsd: number;
  worstCaseSponsorCostUsd: number;
  netUserValueUsd: number;
  quotedAtMs: number;
  expiresAtMs: number;
}

/**
 * Convert NormalizedQuote to USD-comparable RouteQuote format.
 * This enables apples-to-apples comparison between Relay and deBridge routes.
 */
export async function normalizeToRouteQuote(
  quote: NormalizedQuote,
  destinationToken: string,
  destinationChainId: number,
  destinationTokenDecimals: number
): Promise<RouteQuote> {
  const tokenPriceUsd = await getTokenPriceUsd(destinationToken, destinationChainId);

  const userReceivesRaw = BigInt(quote.expectedOut);
  const userReceivesUsd =
    quote.userReceivesUsd ??
    (Number(userReceivesRaw) / 10 ** destinationTokenDecimals) * tokenPriceUsd;

  const userPaysRaw =
    quote.feePayer === "sponsor" ? BigInt(quote.userFee ?? "0") : BigInt(quote.fees);
  const userPaysUsd =
    quote.userPaysUsd ??
    (Number(userPaysRaw) / 10 ** destinationTokenDecimals) * tokenPriceUsd;

  const worstCaseSponsorCostUsd = quote.worstCaseSponsorCostUsd ?? 0;
  const netValueUsd = netUserValueUsd(quote);

  return {
    provider: quote.provider,
    gasless: quote.gasless ?? quote.feePayer === "sponsor",
    requiresSOL:
      quote.requiresSOL ?? (quote.userFeeCurrency === "SOL" || quote.solanaCostToUser != null),
    userReceivesUsd,
    userPaysUsd,
    worstCaseSponsorCostUsd,
    netUserValueUsd: netValueUsd,
    quotedAtMs: Date.now() - (quote.expiryAt - Date.now()),
    expiresAtMs: quote.expiryAt,
  };
}
