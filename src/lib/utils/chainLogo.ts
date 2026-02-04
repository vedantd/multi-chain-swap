/**
 * Chain Logo Utilities
 * 
 * Provides simple chain icons/logos for display in UI.
 * Uses emoji fallbacks for simplicity (no external dependencies).
 */

import { 
  CHAIN_ID_ETHEREUM, 
  CHAIN_ID_BASE, 
  CHAIN_ID_SOLANA, 
  CHAIN_ID_OPTIMISM, 
  CHAIN_ID_ARBITRUM, 
  CHAIN_ID_POLYGON, 
  CHAIN_ID_BNB, 
  CHAIN_ID_AVALANCHE 
} from "@/lib/chainConfig";

/**
 * Get chain icon/emoji for display.
 * Returns emoji as simple fallback (can be replaced with actual logos later).
 * 
 * @param chainId - Chain ID
 * @returns Emoji or icon string
 */
export function getChainIcon(chainId: number): string {
  const icons: Record<number, string> = {
    [CHAIN_ID_SOLANA]: '⚡',
    [CHAIN_ID_ETHEREUM]: '⟠',
    [CHAIN_ID_BASE]: '🔷',
    [CHAIN_ID_OPTIMISM]: '🔴',
    [CHAIN_ID_ARBITRUM]: '🔵',
    [CHAIN_ID_POLYGON]: '🟣',
    [CHAIN_ID_BNB]: '🟡',
    [CHAIN_ID_AVALANCHE]: '🔴',
  };
  
  return icons[chainId] ?? '🔗';
}

/**
 * Get chain logo URL (for future use with actual logo images).
 * Currently returns null - can be extended to use ChainList or other sources.
 * 
 * @param chainId - Chain ID
 * @returns Logo URL or null
 */
export function getChainLogoUrl(chainId: number): string | null {
  // Future: Can use ChainList API or other sources
  // Example: https://chainlist.org/chain/{chainId}
  return null;
}
