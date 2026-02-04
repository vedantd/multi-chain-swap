import { TOKENS_BY_CHAIN } from "@/lib/chainConfig";
import { TOKEN_PRICE_CACHE_MS } from "@/lib/constants";

const priceCache = new Map<string, { price: number; timestamp: number }>();

// Map token symbols to CoinGecko IDs
const COINGECKO_IDS: Record<string, string> = {
  SOL: "solana",
  ETH: "ethereum",
  WETH: "ethereum",
  BNB: "binancecoin",
  MATIC: "matic-network",
  AVAX: "avalanche-2",
};

/**
 * Get token price in USD for route comparison.
 * Fetches from CoinGecko for common tokens, returns 1.0 for stablecoins.
 */
export async function getTokenPriceUsd(
  tokenAddress: string,
  chainId: number
): Promise<number> {
  const tokens = TOKENS_BY_CHAIN[chainId] ?? [];
  const token = tokens.find((t) => t.address.toLowerCase() === tokenAddress.toLowerCase());
  
  // Stablecoins always $1
  if (token?.symbol === "USDC" || token?.symbol === "USDT") {
    return 1.0;
  }
  
  // Check cache
  const cacheKey = `${chainId}-${tokenAddress}`;
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TOKEN_PRICE_CACHE_MS) {
    return cached.price;
  }
  
  // Fetch from CoinGecko if we have a mapping
  const symbol = token?.symbol;
  if (symbol && COINGECKO_IDS[symbol]) {
    try {
      const coingeckoId = COINGECKO_IDS[symbol];
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`
      );
      const data = (await response.json()) as { [key: string]: { usd?: number } };
      const price = data[coingeckoId]?.usd;
      if (price != null && price > 0) {
        priceCache.set(cacheKey, { price, timestamp: Date.now() });
        return price;
      }
    } catch (error) {
      console.warn(`[tokenPrice] Failed to fetch ${token.symbol} price:`, error);
    }
  }
  
  // Fallback to 1.0 if fetch fails or token not mapped
  return 1.0;
}
