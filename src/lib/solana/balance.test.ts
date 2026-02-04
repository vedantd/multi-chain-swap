import { describe, it, expect, vi } from "vitest";
import type { Connection } from "@solana/web3.js";
import { getAtaExists } from "./balance";

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
