/**
 * Shared "popular first" token ordering for selectors.
 * Used by TokenSelect and DestinationSelector so both use the same source of truth.
 */

/** Ordered list of symbols that appear first in token lists. */
const POPULAR_SYMBOLS_ORDER = [
  "SOL",
  "USDC",
  "USDT",
  "ETH",
  "WETH",
  "BNB",
  "MATIC",
  "AVAX",
  "BTC",
  "WBTC",
  "DAI",
  "OP",
  "ARB",
] as const;

export const POPULAR_SYMBOLS = new Set<string>(
  POPULAR_SYMBOLS_ORDER as unknown as string[]
);

/**
 * Sort tokens with popular symbols first (by predefined order), then others alphabetically.
 */
export function sortTokensWithPopularFirst<T extends { label: string }>(
  tokens: T[]
): T[] {
  const popular: T[] = [];
  const others: T[] = [];

  for (const token of tokens) {
    if (POPULAR_SYMBOLS.has(token.label.toUpperCase())) {
      popular.push(token);
    } else {
      others.push(token);
    }
  }

  const orderList: string[] = [...POPULAR_SYMBOLS_ORDER];
  popular.sort((a, b) => {
    const aUpper = a.label.toUpperCase();
    const bUpper = b.label.toUpperCase();
    const aIndex = orderList.indexOf(aUpper);
    const bIndex = orderList.indexOf(bUpper);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });

  others.sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
  );

  return [...popular, ...others];
}
