/**
 * Address normalization and validation utilities.
 * Used for token addresses (EVM lowercase, Solana as-is) and EVM address checks.
 */

/**
 * Normalize a token/contract address for comparison.
 * EVM addresses (0x-prefix) are lowercased; Solana addresses are returned as-is.
 */
export function normalizeTokenAddress(address: string): string {
  return address.startsWith("0x") ? address.toLowerCase() : address;
}

/**
 * Check if a string is a valid EVM address (0x prefix, 42 characters total).
 */
export function isValidEvmAddress(addr: string): boolean {
  return typeof addr === "string" && addr.startsWith("0x") && addr.length === 42;
}
