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
 * Get short chain label for display.
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
