import { Connection, PublicKey } from "@solana/web3.js";

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
