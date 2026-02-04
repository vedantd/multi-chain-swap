import type { Connection } from "@solana/web3.js";

/**
 * Standard token account data length in bytes.
 * Used to calculate rent-exempt minimum balance for SPL tokens.
 */
const STANDARD_TOKEN_ACCOUNT_SIZE = 165;

/**
 * Get the minimum balance required for rent exemption for a given data length.
 * 
 * @param connection - Solana connection
 * @param dataLength - Length of account data in bytes
 * @returns Minimum balance in lamports required for rent exemption
 */
export async function getMinimumBalanceForRentExempt(
  connection: Connection,
  dataLength: number
): Promise<number> {
  return connection.getMinimumBalanceForRentExempt(dataLength);
}

/**
 * Check if a token balance is considered "dust" (too small to cover rent).
 * 
 * Dust amounts cannot be recovered because closing the account would require
 * paying rent, which exceeds the balance itself.
 * 
 * @param balance - Token balance in raw units (lamports for SOL, token units for SPL)
 * @param mint - Token mint address, or "SOL" for native SOL
 * @param connection - Solana connection
 * @returns True if balance is dust (cannot cover rent)
 */
export async function isDustAmount(
  balance: bigint,
  mint: string,
  connection: Connection
): Promise<boolean> {
  const isToken = mint !== "SOL";
  const dataLength = isToken ? STANDARD_TOKEN_ACCOUNT_SIZE : 0;
  const minBalance = await connection.getMinimumBalanceForRentExempt(dataLength);
  return balance < BigInt(minBalance);
}

/**
 * Calculate the dust threshold (minimum balance required to avoid dust).
 * 
 * @param mint - Token mint address, or "SOL" for native SOL
 * @param connection - Solana connection
 * @returns Minimum balance in raw units required to avoid dust
 */
export async function calculateDustThreshold(
  mint: string,
  connection: Connection
): Promise<bigint> {
  const isToken = mint !== "SOL";
  const dataLength = isToken ? STANDARD_TOKEN_ACCOUNT_SIZE : 0;
  const minBalance = await connection.getMinimumBalanceForRentExempt(dataLength);
  return BigInt(minBalance);
}

/**
 * Check if an account is uncloseable (balance exactly at rent-exempt minimum).
 * 
 * Uncloseable accounts cannot be closed without losing the rent deposit,
 * effectively making them permanent.
 * 
 * @param balance - Account balance in raw units
 * @param mint - Token mint address, or "SOL" for native SOL
 * @param connection - Solana connection
 * @returns True if account is uncloseable
 */
export async function isUncloseableAccount(
  balance: bigint,
  mint: string,
  connection: Connection
): Promise<boolean> {
  const threshold = await calculateDustThreshold(mint, connection);
  // Account is uncloseable if balance equals exactly the rent-exempt minimum
  return balance === threshold;
}
