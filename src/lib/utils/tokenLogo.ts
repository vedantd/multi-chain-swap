/**
 * Token Logo Utilities
 *
 * Uses only local logos from /public. No external requests (e.g. CoinGecko).
 * Falls back to generic token icon in the UI when no local logo is mapped.
 */

/**
 * Local logo paths (files in /public). No external requests.
 */
const LOCAL_LOGO_BY_SYMBOL: Record<string, string> = {
  ETH: "/eth.png",
  WETH: "/eth.png",
  SOL: "/solana.png",
  USDC: "/usdc.png",
  USDT: "/usdt.png",
};

/**
 * Get token logo URL. Returns only local /public paths; no external requests.
 *
 * @param _tokenAddress - Token contract address (unused; kept for API compatibility)
 * @param _chainId - Chain ID (unused; kept for API compatibility)
 * @param tokenSymbol - Token symbol for local lookup
 * @returns Local path or null
 */
export function getTokenLogoUrl(_tokenAddress: string, _chainId?: number, tokenSymbol?: string): string | null {
  if (!tokenSymbol) return null;
  const symbolUpper = tokenSymbol.toUpperCase().trim();
  return LOCAL_LOGO_BY_SYMBOL[symbolUpper] ?? null;
}

/**
 * Get a generic token icon URL as fallback.
 * Uses a simple SVG data URL for a generic token icon.
 */
export function getGenericTokenIcon(): string {
  // Simple generic token icon as SVG data URL
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 6v6l4 2'/%3E%3C/svg%3E";
}
