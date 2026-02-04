import { describe, it, expect, vi } from "vitest";
import type { Connection } from "@solana/web3.js";
import { CHAIN_ID_SOLANA } from "@/lib/chainConfig";
import type { SwapParams } from "@/types/swap";
import { calculateWorstCaseCosts } from "./quote";

vi.mock("@/lib/solana/balance", () => ({
  getAtaExists: vi.fn(),
  getSolBalance: vi.fn(),
  getTokenBalance: vi.fn(),
}));
vi.mock("@/lib/solana/tokenDetection", () => ({
  detectToken2022: vi.fn().mockResolvedValue({ hasTransferFees: false }),
}));

const { getAtaExists } = await import("@/lib/solana/balance");

function baseParams(overrides: Partial<SwapParams> = {}): SwapParams {
  return {
    originChainId: CHAIN_ID_SOLANA,
    originToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    amount: "100000000",
    destinationChainId: 42161,
    destinationToken: "0xaf88d065e77c8cC2239327C5EDb3A9322683F0A2",
    userAddress: "UserSolana11111111111111111111111111111",
    tradeType: "exact_in",
    ...overrides,
  };
}

describe("calculateWorstCaseCosts", () => {
  const solPriceUsd = 150;
  const expectedOutUsd = 100;

  it("sets rentUsd to 0 when depositFeePayer is user (user already has origin ATA)", async () => {
    const params = baseParams();
    const connection = {} as Connection;
    const costs = await calculateWorstCaseCosts(params, expectedOutUsd, solPriceUsd, connection, params.userAddress);
    expect(costs.rentUsd).toBe(0);
    expect(costs.gasUsd).toBeGreaterThan(0);
    expect(costs.driftBufferUsd).toBeGreaterThan(0);
    expect(costs.failureBufferUsd).toBeGreaterThan(0);
  });

  it("sets rentUsd to 0 when depositFeePayer is not user but getAtaExists returns true", async () => {
    vi.mocked(getAtaExists).mockResolvedValue(true);
    const params = baseParams();
    const connection = {} as Connection;
    const sponsor = "SponsorSolana11111111111111111111111111";
    const costs = await calculateWorstCaseCosts(params, expectedOutUsd, solPriceUsd, connection, sponsor);
    expect(costs.rentUsd).toBe(0);
    expect(getAtaExists).toHaveBeenCalledWith(connection, sponsor, params.originToken);
  });

  it("sets rentUsd > 0 when getAtaExists returns false (sponsor ATA missing)", async () => {
    vi.mocked(getAtaExists).mockResolvedValue(false);
    const params = baseParams();
    const connection = {} as Connection;
    const sponsor = "SponsorSolana11111111111111111111111111";
    const costs = await calculateWorstCaseCosts(params, expectedOutUsd, solPriceUsd, connection, sponsor);
    const expectedRentUsd = (2_039_280 / 1e9) * solPriceUsd;
    expect(costs.rentUsd).toBeCloseTo(expectedRentUsd, 6);
  });

  it("sets rentUsd > 0 when connection is missing (conservative fallback)", async () => {
    const params = baseParams();
    const sponsor = "SponsorSolana11111111111111111111111111";
    const costs = await calculateWorstCaseCosts(params, expectedOutUsd, solPriceUsd, undefined, sponsor);
    const expectedRentUsd = (2_039_280 / 1e9) * solPriceUsd;
    expect(costs.rentUsd).toBeCloseTo(expectedRentUsd, 6);
  });

  it("sets rentUsd > 0 when getAtaExists throws (conservative fallback)", async () => {
    vi.mocked(getAtaExists).mockRejectedValue(new Error("RPC error"));
    const params = baseParams();
    const connection = {} as Connection;
    const sponsor = "SponsorSolana11111111111111111111111111";
    const costs = await calculateWorstCaseCosts(params, expectedOutUsd, solPriceUsd, connection, sponsor);
    const expectedRentUsd = (2_039_280 / 1e9) * solPriceUsd;
    expect(costs.rentUsd).toBeCloseTo(expectedRentUsd, 6);
  });

  it("sets rentUsd to 0 when origin is not Solana", async () => {
    const params = baseParams({ originChainId: 42161 });
    const connection = {} as Connection;
    const sponsor = "0x1234567890123456789012345678901234567890";
    const costs = await calculateWorstCaseCosts(params, expectedOutUsd, solPriceUsd, connection, sponsor);
    expect(costs.rentUsd).toBe(0);
  });
});
