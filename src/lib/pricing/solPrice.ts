import { SOL_PRICE_CACHE_MS } from "@/lib/constants";

let cachedPrice: { price: number; timestamp: number } | null = null;

export async function getSolPriceInUsdc(): Promise<number> {
  if (cachedPrice && Date.now() - cachedPrice.timestamp < SOL_PRICE_CACHE_MS) {
    return cachedPrice.price;
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    const data = (await response.json()) as { solana?: { usd?: number } };
    const price = data.solana?.usd ?? 150; // Fallback to $150
    cachedPrice = { price, timestamp: Date.now() };
    return price;
  } catch {
    return 150; // Fallback fixed rate
  }
}

export function lamportsToUsdc(lamports: string, solPriceUsd: number): string {
  const lamportsNum = Number(lamports);
  const solAmount = lamportsNum / 1e9;
  const usdcAmount = solAmount * solPriceUsd;
  return String(Math.ceil(usdcAmount * 1e6)); // Convert to USDC raw (6 decimals)
}
