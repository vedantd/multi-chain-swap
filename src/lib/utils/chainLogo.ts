/**
 * Chain Logo Utilities
 *
 * Provides short chain labels for display in UI (no emoji).
 */

import {
  CHAIN_ID_ETHEREUM,
  CHAIN_ID_BASE,
  CHAIN_ID_SOLANA,
  CHAIN_ID_OPTIMISM,
  CHAIN_ID_ARBITRUM,
  CHAIN_ID_POLYGON,
  CHAIN_ID_BNB,
  CHAIN_ID_AVALANCHE,
} from "@/lib/chainConfig";

/**
 * Get short chain label for display (fallback when no logo).
 *
 * @param chainId - Chain ID
 * @returns Short label (e.g. SOL, ETH, BASE)
 */
export function getChainIcon(chainId: number): string {
  const labels: Record<number, string> = {
    [CHAIN_ID_SOLANA]: "SOL",
    [CHAIN_ID_ETHEREUM]: "ETH",
    [CHAIN_ID_BASE]: "BASE",
    [CHAIN_ID_OPTIMISM]: "OP",
    [CHAIN_ID_ARBITRUM]: "ARB",
    [CHAIN_ID_POLYGON]: "MATIC",
    [CHAIN_ID_BNB]: "BNB",
    [CHAIN_ID_AVALANCHE]: "AVAX",
  };
  return labels[chainId] ?? "—";
}

/** Chain IDs that have a logo image in public/ */
const CHAIN_LOGO_PATHS: Record<number, string> = {
  [CHAIN_ID_ETHEREUM]: "/eth.png",
  [CHAIN_ID_SOLANA]: "/solana.png",
  [CHAIN_ID_BNB]: "/bnb.png",
  [CHAIN_ID_AVALANCHE]: "/avax.png",
};

/**
 * Get chain logo image URL for display.
 *
 * @param chainId - Chain ID
 * @returns Public path to logo (e.g. /bnb.png) or null if no logo
 */
export function getChainLogoUrl(chainId: number): string | null {
  return CHAIN_LOGO_PATHS[chainId] ?? null;
}
