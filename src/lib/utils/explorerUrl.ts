/**
 * Explorer URLs for transaction links (Solana Explorer, Etherscan).
 */

export type ExplorerProvider = "solana" | "evm";

const EXPLORER_SOLANA_TX = "https://explorer.solana.com/tx";
const EXPLORER_ETH_TX = "https://etherscan.io/tx";

/**
 * Get the block explorer URL for a transaction signature/hash.
 */
export function getExplorerUrlForSignature(
  signature: string,
  provider: ExplorerProvider
): string {
  if (provider === "solana") {
    return `${EXPLORER_SOLANA_TX}/${signature}`;
  }
  return `${EXPLORER_ETH_TX}/${signature}`;
}
