import { Connection, PublicKey } from "@solana/web3.js";
import { isDustAmount, isUncloseableAccount, calculateDustThreshold } from "./dustDetection";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

/**
 * Derive the Associated Token Account address for a given mint and owner.
 * This is equivalent to getAssociatedTokenAddress from @solana/spl-token.
 */
async function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

export async function getSolBalance(
  connection: Connection,
  address: string
): Promise<string> {
  const pubkey = new PublicKey(address);
  const balance = await connection.getBalance(pubkey);
  return String(balance);
}

export async function getTokenBalance(
  connection: Connection,
  address: string,
  mint: string
): Promise<string> {
  try {
    const userPubkey = new PublicKey(address);
    const mintPubkey = new PublicKey(mint);
    const ata = await getAssociatedTokenAddress(mintPubkey, userPubkey);
    const balance = await connection.getTokenAccountBalance(ata);
    return balance.value.amount;
  } catch {
    return "0";
  }
}

/**
 * Check if an Associated Token Account exists for the given owner and mint.
 * Returns true if the account exists and has data, false if it does not exist or on error
 * (so callers can treat as unknown and fall back to conservative behavior).
 */
export async function getAtaExists(
  connection: Connection,
  owner: string,
  mint: string
): Promise<boolean> {
  try {
    const ownerPubkey = new PublicKey(owner);
    const mintPubkey = new PublicKey(mint);
    const ata = await getAssociatedTokenAddress(mintPubkey, ownerPubkey);
    const accountInfo = await connection.getAccountInfo(ata);
    return accountInfo !== null && accountInfo.data !== undefined && accountInfo.data.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if a balance would result in dust or an uncloseable account after a swap.
 * 
 * @param connection - Solana connection
 * @param address - User's wallet address
 * @param mint - Token mint address, or "SOL" for native SOL
 * @param currentBalance - Current balance in raw units
 * @param swapAmount - Amount being swapped out in raw units
 * @returns Object indicating if swap would create dust or uncloseable account
 */
export async function checkDustAndUncloseable(
  connection: Connection,
  address: string,
  mint: string,
  currentBalance: string,
  swapAmount: string
): Promise<{ isDust: boolean; isUncloseable: boolean; dustAmount: string; remainingBalance: string }> {
  try {
    const currentBalanceBigInt = BigInt(currentBalance);
    const swapAmountBigInt = BigInt(swapAmount);
    
    if (currentBalanceBigInt < swapAmountBigInt) {
      // Not enough balance to swap
      return {
        isDust: false,
        isUncloseable: false,
        dustAmount: "0",
        remainingBalance: currentBalance,
      };
    }
    
    const remainingBalance = currentBalanceBigInt - swapAmountBigInt;

    // Dust threshold is only comparable for SOL: it's in lamports. For SPL tokens,
    // currentBalance/swapAmount/remainingBalance are in token raw units, so we must
    // not compare them to the rent-exempt minimum (lamports).
    const isSol = mint === "SOL";
    let isDust: boolean;
    let isUncloseable: boolean;

    if (isSol) {
      const dustThreshold = await calculateDustThreshold(mint, connection);
      isDust = remainingBalance < dustThreshold;
      isUncloseable = remainingBalance === dustThreshold;
    } else {
      // For SPL tokens, balance is in token raw units. Rent-exempt minimum is in lamports,
      // so we must not compare them. Only SOL uses the lamports dust threshold.
      isDust = false;
      isUncloseable = false;
    }

    return {
      isDust,
      isUncloseable,
      dustAmount: isDust ? String(remainingBalance) : "0",
      remainingBalance: String(remainingBalance),
    };
  } catch {
    // On error, assume no dust (conservative approach)
    return {
      isDust: false,
      isUncloseable: false,
      dustAmount: "0",
      remainingBalance: "0",
    };
  }
}
