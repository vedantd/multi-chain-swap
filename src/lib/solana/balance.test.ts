import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Connection } from "@solana/web3.js";
import { getAtaExists, checkDustAndUncloseable } from "./balance";

describe("getAtaExists", () => {
  it("returns true when account exists and has data", async () => {
    const connection = {
      getAccountInfo: vi.fn().mockResolvedValue({ data: new Uint8Array(165), executable: false, owner: {} }),
    } as unknown as Connection;
    const result = await getAtaExists(connection, "Av29j1oEbWAt77AzXyTA2fAzRnHytfG3mEV8kYm5E83M", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(result).toBe(true);
  });

  it("returns false when account is null (does not exist)", async () => {
    const connection = {
      getAccountInfo: vi.fn().mockResolvedValue(null),
    } as unknown as Connection;
    const result = await getAtaExists(connection, "Av29j1oEbWAt77AzXyTA2fAzRnHytfG3mEV8kYm5E83M", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(result).toBe(false);
  });

  it("returns false when getAccountInfo throws (RPC error)", async () => {
    const connection = {
      getAccountInfo: vi.fn().mockRejectedValue(new Error("RPC error")),
    } as unknown as Connection;
    const result = await getAtaExists(connection, "Av29j1oEbWAt77AzXyTA2fAzRnHytfG3mEV8kYm5E83M", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(result).toBe(false);
  });

  it("returns false when account has no data", async () => {
    const connection = {
      getAccountInfo: vi.fn().mockResolvedValue({ data: undefined, executable: false, owner: {} }),
    } as unknown as Connection;
    const result = await getAtaExists(connection, "Av29j1oEbWAt77AzXyTA2fAzRnHytfG3mEV8kYm5E83M", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(result).toBe(false);
  });
});

describe("checkDustAndUncloseable", () => {
  const mockConnection = {
    getMinimumBalanceForRentExempt: vi.fn(),
  } as unknown as Connection;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects dust for SOL when remaining balance is below rent-exempt minimum", async () => {
    vi.mocked(mockConnection.getMinimumBalanceForRentExempt).mockResolvedValue(890880); // ~0.00089 SOL
    const result = await checkDustAndUncloseable(
      mockConnection,
      "UserSolana11111111111111111111111111111",
      "SOL",
      "1000000", // 0.001 SOL
      "200000" // Swap out 0.0002 SOL, leaving 0.0008 SOL (below minimum)
    );
    expect(result.isDust).toBe(true);
    expect(result.isUncloseable).toBe(false);
    expect(result.remainingBalance).toBe("800000");
  });

  it("detects dust for SPL tokens when remaining balance is below rent-exempt minimum", async () => {
    vi.mocked(mockConnection.getMinimumBalanceForRentExempt).mockResolvedValue(2039280); // Standard token account rent
    const result = await checkDustAndUncloseable(
      mockConnection,
      "UserSolana11111111111111111111111111111",
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "10000000", // 10 USDC (6 decimals)
      "8000000" // Swap out 8 USDC, leaving 2 USDC (below rent minimum in lamports)
    );
    expect(result.isDust).toBe(true);
    expect(result.isUncloseable).toBe(false);
  });

  it("detects uncloseable account when balance equals rent-exempt minimum", async () => {
    const rentExemptMin = 890880;
    vi.mocked(mockConnection.getMinimumBalanceForRentExempt).mockResolvedValue(rentExemptMin);
    const totalBalance = String(rentExemptMin + 100000); // Start with more than minimum
    const swapAmount = "100000"; // Swap out amount that leaves exactly minimum
    const result = await checkDustAndUncloseable(
      mockConnection,
      "UserSolana11111111111111111111111111111",
      "SOL",
      totalBalance,
      swapAmount
    );
    expect(result.isDust).toBe(false);
    expect(result.isUncloseable).toBe(true);
    expect(result.remainingBalance).toBe(String(rentExemptMin));
  });

  it("returns no dust when remaining balance is above rent-exempt minimum", async () => {
    vi.mocked(mockConnection.getMinimumBalanceForRentExempt).mockResolvedValue(890880);
    const result = await checkDustAndUncloseable(
      mockConnection,
      "UserSolana11111111111111111111111111111",
      "SOL",
      "10000000", // 0.01 SOL
      "1000000" // Swap out 0.001 SOL, leaving 0.009 SOL (well above minimum)
    );
    expect(result.isDust).toBe(false);
    expect(result.isUncloseable).toBe(false);
  });

  it("returns no dust when balance is insufficient for swap", async () => {
    vi.mocked(mockConnection.getMinimumBalanceForRentExempt).mockResolvedValue(890880);
    const result = await checkDustAndUncloseable(
      mockConnection,
      "UserSolana11111111111111111111111111111",
      "SOL",
      "100000", // 0.0001 SOL
      "200000" // Try to swap out more than available
    );
    expect(result.isDust).toBe(false);
    expect(result.isUncloseable).toBe(false);
    expect(result.remainingBalance).toBe("100000");
  });

  it("handles errors gracefully", async () => {
    vi.mocked(mockConnection.getMinimumBalanceForRentExempt).mockRejectedValue(new Error("RPC error"));
    const result = await checkDustAndUncloseable(
      mockConnection,
      "UserSolana11111111111111111111111111111",
      "SOL",
      "1000000",
      "200000"
    );
    // Should return conservative result (no dust) on error
    expect(result.isDust).toBe(false);
    expect(result.isUncloseable).toBe(false);
  });
});
