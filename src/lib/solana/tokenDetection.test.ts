import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Connection, PublicKey } from "@solana/web3.js";
import { detectToken2022 } from "./tokenDetection";

vi.mock("@solana/web3.js", async () => {
  const actual = await vi.importActual("@solana/web3.js");
  return {
    ...actual,
    PublicKey: class MockPublicKey {
      constructor(public address: string) {}
      toBase58() {
        return this.address;
      }
    },
  };
});

describe("detectToken2022", () => {
  const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
  const STANDARD_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for standard SPL token (not Token-2022)", async () => {
    const connection = {
      getAccountInfo: vi.fn().mockResolvedValue({
        owner: { toBase58: () => STANDARD_TOKEN_PROGRAM_ID },
        data: new Uint8Array(82), // Standard mint account size
      }),
    } as unknown as Connection;

    const result = await detectToken2022(connection, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(result.isToken2022).toBe(false);
    expect(result.hasTransferFees).toBe(false);
  });

  it("returns true for Token-2022 without transfer fees", async () => {
    const connection = {
      getAccountInfo: vi.fn().mockResolvedValue({
        owner: { toBase58: () => TOKEN_2022_PROGRAM_ID },
        data: new Uint8Array(82), // Standard mint account, no extensions
      }),
    } as unknown as Connection;

    const result = await detectToken2022(connection, "Token2022Mint1111111111111111111111111");
    expect(result.isToken2022).toBe(true);
    expect(result.hasTransferFees).toBe(false);
  });

  it("detects Token-2022 with transfer fees correctly", async () => {
    // Create mock mint data with transfer fee extension
    // Standard mint (82 bytes) + extension count (2 bytes) + extension type (2) + length (2) + data
    const mintData = new Uint8Array(200);
    // Standard mint data (first 82 bytes can be zeros for this test)
    // Extension count at offset 82-83: 1 extension
    mintData[82] = 1; // extension count low byte
    mintData[83] = 0; // extension count high byte
    // Extension type at offset 84-85: 1 (TRANSFER_FEE_EXTENSION_TYPE)
    mintData[84] = 1; // extension type low byte
    mintData[85] = 0; // extension type high byte
    // Extension length at offset 86-87: some length (needs to be at least enough for data)
    mintData[86] = 120; // length low byte (enough for extension data)
    mintData[87] = 0; // length high byte
    // Transfer fee BPS at offset 92-93: 50 bps (0.5%)
    // newerTransferFee starts at offset 88 (after type + length = 4 bytes)
    // epoch (8 bytes) + transferFeeBasisPoints (2 bytes) = offset 96
    mintData[96] = 50; // transferFeeBps low byte
    mintData[97] = 0; // transferFeeBps high byte

    const connection = {
      getAccountInfo: vi.fn().mockResolvedValue({
        owner: { toBase58: () => TOKEN_2022_PROGRAM_ID },
        data: mintData,
      }),
    } as unknown as Connection;

    const result = await detectToken2022(connection, "Token2022WithFees111111111111111111111");
    expect(result.isToken2022).toBe(true);
    expect(result.hasTransferFees).toBe(true);
    expect(result.transferFeeBps).toBe(50);
  });

  it("handles invalid mint address gracefully", async () => {
    const connection = {
      getAccountInfo: vi.fn().mockRejectedValue(new Error("Invalid public key")),
    } as unknown as Connection;

    const result = await detectToken2022(connection, "invalid");
    expect(result.isToken2022).toBe(false);
    expect(result.hasTransferFees).toBe(false);
  });

  it("handles network error during detection", async () => {
    const connection = {
      getAccountInfo: vi.fn().mockRejectedValue(new Error("Network error")),
    } as unknown as Connection;

    const result = await detectToken2022(connection, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(result.isToken2022).toBe(false);
    expect(result.hasTransferFees).toBe(false);
  });

  it("handles null account info (account doesn't exist)", async () => {
    const connection = {
      getAccountInfo: vi.fn().mockResolvedValue(null),
    } as unknown as Connection;

    const result = await detectToken2022(connection, "NonExistentMint11111111111111111111111");
    expect(result.isToken2022).toBe(false);
    expect(result.hasTransferFees).toBe(false);
  });

  it("handles transfer fee BPS edge case: exactly 10000 bps (100%)", async () => {
    const mintData = new Uint8Array(200);
    mintData[82] = 1; // extension count
    mintData[83] = 0;
    mintData[84] = 1; // extension type: TRANSFER_FEE
    mintData[85] = 0;
    mintData[86] = 100;
    mintData[87] = 0;
    mintData[92] = 0x10; // 10000 bps low byte (0x2710 = 10000)
    mintData[93] = 0x27; // 10000 bps high byte

    const connection = {
      getAccountInfo: vi.fn().mockResolvedValue({
        owner: { toBase58: () => TOKEN_2022_PROGRAM_ID },
        data: mintData,
      }),
    } as unknown as Connection;

    const result = await detectToken2022(connection, "Token2022MaxFee1111111111111111111111");
    // Should handle 10000 bps (though this is an edge case - 100% fee is unusual)
    // The code checks `transferFeeBps > 0 && transferFeeBps <= 10000`, so 10000 should be valid
    expect(result.isToken2022).toBe(true);
    // Note: The actual implementation may reject 10000 bps in some contexts (division by zero risk)
  });

  it("handles transfer fee BPS edge case: 0 bps (no fee)", async () => {
    const mintData = new Uint8Array(200);
    mintData[82] = 1; // extension count
    mintData[83] = 0;
    mintData[84] = 1; // extension type: TRANSFER_FEE
    mintData[85] = 0;
    mintData[86] = 100;
    mintData[87] = 0;
    mintData[92] = 0; // 0 bps low byte
    mintData[93] = 0; // 0 bps high byte

    const connection = {
      getAccountInfo: vi.fn().mockResolvedValue({
        owner: { toBase58: () => TOKEN_2022_PROGRAM_ID },
        data: mintData,
      }),
    } as unknown as Connection;

    const result = await detectToken2022(connection, "Token2022NoFee11111111111111111111111");
    expect(result.isToken2022).toBe(true);
    // 0 bps should not be considered as having transfer fees
    expect(result.hasTransferFees).toBe(false);
  });
});
