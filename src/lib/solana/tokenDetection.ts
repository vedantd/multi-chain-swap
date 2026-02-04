import { Connection, PublicKey } from "@solana/web3.js";

const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

/**
 * Transfer Fee Extension Type ID (from Token-2022 program)
 * Extension type is a u16 value stored in the extension header
 */
const TRANSFER_FEE_EXTENSION_TYPE = 1;

/**
 * Parse Token-2022 extension data to detect transfer fees.
 * 
 * Extension layout (simplified):
 * - Extension header: 2 bytes (extension type)
 * - Extension length: 2 bytes
 * - Extension data: variable length
 * 
 * Transfer Fee Extension data structure:
 * - newerTransferFee: { epoch: u64, transferFeeBasisPoints: u16, maximumFee: u64 }
 * - olderTransferFee: { epoch: u64, transferFeeBasisPoints: u16, maximumFee: u64 }
 * - transferFeeConfigAuthority: 32 bytes (Pubkey)
 * - withdrawWithheldAuthority: 32 bytes (Pubkey)
 * - withheldAmount: u64
 */
function parseTransferFeeExtension(data: Uint8Array, offset: number): { transferFeeBps: number } | null {
  try {
    // Skip extension type (2 bytes) and length (2 bytes) - already parsed
    // Read newerTransferFee
    const newerEpochOffset = offset + 4;
    const newerTransferFeeBpsOffset = newerEpochOffset + 8; // Skip epoch (u64 = 8 bytes)
    
    if (newerTransferFeeBpsOffset + 2 > data.length) {
      return null;
    }

    // Read transferFeeBasisPoints (u16, little-endian)
    if (newerTransferFeeBpsOffset + 1 >= data.length) {
      return null;
    }
    const transferFeeBps = (data[newerTransferFeeBpsOffset] ?? 0) | ((data[newerTransferFeeBpsOffset + 1] ?? 0) << 8);
    
    if (transferFeeBps > 0 && transferFeeBps <= 10000) { // Valid range: 0-10000 bps (0-100%)
      return { transferFeeBps };
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse Token-2022 mint account extensions to find transfer fee extension.
 * 
 * Extension layout in mint account:
 * - Standard mint data (82 bytes)
 * - Extension count (u16)
 * - For each extension:
 *   - Extension type (u16)
 *   - Extension length (u16)
 *   - Extension data (variable)
 */
function findTransferFeeExtension(mintData: Uint8Array): { transferFeeBps: number } | null {
  try {
    // Standard mint account size is 82 bytes
    // Extensions start after the standard mint data
    const STANDARD_MINT_SIZE = 82;
    
    if (mintData.length < STANDARD_MINT_SIZE + 2) {
      return null; // No extensions
    }

    // Read extension count (u16, little-endian)
    const extensionCountOffset = STANDARD_MINT_SIZE;
    if (extensionCountOffset + 1 >= mintData.length) {
      return null;
    }
    const extensionCount = (mintData[extensionCountOffset] ?? 0) | ((mintData[extensionCountOffset + 1] ?? 0) << 8);
    
    if (extensionCount === 0) {
      return null;
    }

    let currentOffset = extensionCountOffset + 2;

    // Iterate through extensions
    for (let i = 0; i < extensionCount && currentOffset + 4 <= mintData.length; i++) {
      // Read extension type (u16, little-endian)
      if (currentOffset + 3 >= mintData.length) break;
      const byte0 = mintData[currentOffset];
      const byte1 = mintData[currentOffset + 1];
      const byte2 = mintData[currentOffset + 2];
      const byte3 = mintData[currentOffset + 3];
      
      if (byte0 === undefined || byte1 === undefined || byte2 === undefined || byte3 === undefined) {
        break;
      }
      
      const extensionType = byte0 | (byte1 << 8);
      const extensionLength = byte2 | (byte3 << 8);
      
      // Check if this is the transfer fee extension
      if (extensionType === TRANSFER_FEE_EXTENSION_TYPE) {
        const extensionData = parseTransferFeeExtension(mintData, currentOffset);
        if (extensionData) {
          return extensionData;
        }
      }
      
      // Move to next extension (type + length + data)
      currentOffset += 4 + extensionLength;
    }

    return null;
  } catch {
    return null;
  }
}

export async function detectToken2022(
  connection: Connection,
  mint: string
): Promise<{ isToken2022: boolean; hasTransferFees: boolean; transferFeeBps?: number }> {
  try {
    const mintPubkey = new PublicKey(mint);
    const mintInfo = await connection.getAccountInfo(mintPubkey);

    if (!mintInfo || !mintInfo.data) {
      return { isToken2022: false, hasTransferFees: false };
    }

    const isToken2022 = mintInfo.owner.toBase58() === TOKEN_2022_PROGRAM_ID;

    if (!isToken2022) {
      return { isToken2022: false, hasTransferFees: false };
    }

    // Parse extension data to detect transfer fees
    const transferFeeData = findTransferFeeExtension(mintInfo.data);
    
    if (transferFeeData && transferFeeData.transferFeeBps > 0) {
      return {
        isToken2022: true,
        hasTransferFees: true,
        transferFeeBps: transferFeeData.transferFeeBps,
      };
    }

    return {
      isToken2022: true,
      hasTransferFees: false,
    };
  } catch (error) {
    console.warn("[tokenDetection] Error detecting Token-2022:", error);
    return { isToken2022: false, hasTransferFees: false };
  }
}
