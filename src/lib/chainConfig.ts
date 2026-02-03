/**
 * Chain ID mapping and token config for Relay and deBridge.
 * Internal chain IDs align with common conventions; adapters map to provider-specific IDs where needed.
 */

/** Solana chain ID in deBridge DLN API */
export const DEBRIDGE_CHAIN_ID_SOLANA = 7565164;

/** Solana chain ID in Relay API (from GET https://api.relay.link/chains; vmType "svm") */
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

/** Chain IDs valid for destination when origin is always Solana */
export const DESTINATION_CHAIN_IDS = CHAIN_IDS.filter(
  (id) => id !== CHAIN_ID_SOLANA
);

export type ChainId = (typeof CHAIN_IDS)[number];

/** Map our internal chain ID to Relay's originChainId/destinationChainId (Relay has a separate Solana id) */
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

/** Decimals by symbol for formatting fee/amount display */
const DECIMALS_BY_SYMBOL: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  ETH: 18,
  WETH: 18,
  SOL: 9,
};

/** Format raw token amount for display (e.g. "26208" + "USDC" -> "0.026") */
export function formatRawAmount(raw: string, currencySymbol: string): string {
  const decimals = DECIMALS_BY_SYMBOL[currencySymbol] ?? 6;
  try {
    const n = BigInt(raw);
    if (n === 0n) return "0";
    const div = 10 ** decimals;
    const intPart = n / BigInt(div);
    const fracPart = n % BigInt(div);
    const fracStr = fracPart.toString().padStart(decimals, "0").replace(/0+$/, "");
    return fracStr ? `${intPart}.${fracStr}` : String(intPart);
  } catch {
    return raw;
  }
}

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
