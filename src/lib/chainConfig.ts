/**
 * Chain ID mapping and token config for Relay and deBridge.
 * Internal chain IDs align with common conventions; adapters map to provider-specific IDs where needed.
 */

/** Solana chain ID in deBridge DLN API */
export const DEBRIDGE_CHAIN_ID_SOLANA = 7565164;

/** Solana chain ID in Relay API. Matches Relay chain list (GET https://api.relay.link/chains; vmType "svm"). */
export const RELAY_CHAIN_ID_SOLANA = 792703809;

/** Internal chain ID for Solana (matches deBridge; Relay gets mapped via toRelayChainId) */
export const CHAIN_ID_SOLANA_INTERNAL = DEBRIDGE_CHAIN_ID_SOLANA;

/** Estimated lamports user pays for a Solana origin tx (e.g. deBridge). ~0.015 SOL. */
export const ESTIMATED_SOLANA_TX_LAMPORTS = "15000000";

/** Common chain IDs (EVM convention; Solana = deBridge ID for consistency) */
export const CHAIN_ID_ETHEREUM = 1;
export const CHAIN_ID_OPTIMISM = 10;
export const CHAIN_ID_BNB = 56;
export const CHAIN_ID_POLYGON = 137;
export const CHAIN_ID_BASE = 8453;
export const CHAIN_ID_ARBITRUM = 42161;
export const CHAIN_ID_AVALANCHE = 43114;
export const CHAIN_ID_SOLANA = CHAIN_ID_SOLANA_INTERNAL;

export const CHAIN_IDS = [
  CHAIN_ID_ETHEREUM,
  CHAIN_ID_OPTIMISM,
  CHAIN_ID_BNB,
  CHAIN_ID_POLYGON,
  CHAIN_ID_BASE,
  CHAIN_ID_ARBITRUM,
  CHAIN_ID_AVALANCHE,
  CHAIN_ID_SOLANA,
] as const;

/** Chain IDs available as destination (all chains; user can swap to any chain including Solana). */
export const DESTINATION_CHAIN_IDS = [...CHAIN_IDS];

export type ChainId = (typeof CHAIN_IDS)[number];

/** Map our internal chain ID to Relay's originChainId/destinationChainId. EVM chains pass through; Solana maps to RELAY_CHAIN_ID_SOLANA (per api.relay.link/chains). */
export function toRelayChainId(chainId: number): number {
  if (chainId === CHAIN_ID_SOLANA_INTERNAL) return RELAY_CHAIN_ID_SOLANA;
  return chainId;
}

/** Map our chain ID to deBridge's srcChainId/dstChainId (string in API) */
export function toDebridgeChainId(chainId: number): string {
  return String(chainId);
}

/** Token with decimals for human-readable amount conversion */
export interface ChainToken {
  address: string;
  symbol: string;
  decimals: number;
}

/** Minimal token list for UI (address per chain); extend as needed */
export const TOKENS_BY_CHAIN: Record<number, ChainToken[]> = {
  [CHAIN_ID_ETHEREUM]: [
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
    { address: "0x0000000000000000000000000000000000000000", symbol: "ETH", decimals: 18 },
  ],
  [CHAIN_ID_BASE]: [
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
  ],
  [CHAIN_ID_SOLANA]: [
    { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", decimals: 6 },
    { address: "So11111111111111111111111111111111111111112", symbol: "SOL", decimals: 9 },
  ],
  [CHAIN_ID_OPTIMISM]: [
    { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", decimals: 6 },
  ],
  [CHAIN_ID_ARBITRUM]: [
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 },
  ],
  [CHAIN_ID_BNB]: [
    { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", decimals: 18 },
    { address: "0x0000000000000000000000000000000000000000", symbol: "BNB", decimals: 18 },
  ],
  [CHAIN_ID_POLYGON]: [
    { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC", decimals: 6 },
    { address: "0x0000000000000000000000000000000000001010", symbol: "MATIC", decimals: 18 },
  ],
  [CHAIN_ID_AVALANCHE]: [
    { address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", symbol: "USDC", decimals: 6 },
    { address: "0x0000000000000000000000000000000000000000", symbol: "AVAX", decimals: 18 },
  ],
};

/** Chain IDs that use EVM (0x) addresses for recipient/authority */
export const EVM_CHAIN_IDS = new Set([
  CHAIN_ID_ETHEREUM,
  CHAIN_ID_OPTIMISM,
  CHAIN_ID_BNB,
  CHAIN_ID_POLYGON,
  CHAIN_ID_BASE,
  CHAIN_ID_ARBITRUM,
  CHAIN_ID_AVALANCHE,
]);

export function isEvmChain(chainId: number): boolean {
  return EVM_CHAIN_IDS.has(chainId);
}

/**
 * Convert human-readable amount (e.g. 10 for 10 USDC) to raw smallest units.
 * Uses integer rounding to avoid float precision issues.
 */
export function humanAmountToRaw(humanAmount: string, decimals: number): string {
  const n = Number(humanAmount);
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n === 0) return "0";
  const factor = 10 ** decimals;
  const raw = Math.round(n * factor);
  return String(raw);
}

// Re-export formatting utilities for backward compatibility
export { formatRawAmount, formatRawAmountWithDecimals } from "./utils/formatting";

export function getChainName(chainId: number): string {
  const names: Record<number, string> = {
    [CHAIN_ID_ETHEREUM]: "Ethereum",
    [CHAIN_ID_OPTIMISM]: "Optimism",
    [CHAIN_ID_BNB]: "BNB Chain",
    [CHAIN_ID_POLYGON]: "Polygon",
    [CHAIN_ID_BASE]: "Base",
    [CHAIN_ID_ARBITRUM]: "Arbitrum",
    [CHAIN_ID_AVALANCHE]: "Avalanche",
    [CHAIN_ID_SOLANA]: "Solana",
  };
  return names[chainId] ?? `Chain ${chainId}`;
}
