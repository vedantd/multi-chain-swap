import { describe, it, expect, vi } from "vitest";
import type { NormalizedQuote, SwapParams } from "@/types/swap";
import {
  getQuotes,
  sortByBest,
  costToUserRaw,
  effectiveReceiveRaw,
} from "./quoteService";

vi.mock("@/lib/relay/quote", () => ({
  getRelayQuote: vi.fn(),
}));
vi.mock("@/lib/debridge/quote", () => ({
  getDebridgeQuote: vi.fn(),
}));

function mockQuote(overrides: Partial<NormalizedQuote>): NormalizedQuote {
  return {
    provider: "relay",
    expectedOut: "0",
    expectedOutFormatted: "0",
    fees: "0",
    feeCurrency: "USDC",
    feePayer: "sponsor",
    sponsorCost: "0",
    expiryAt: Date.now() + 30_000,
    raw: {},
    ...overrides,
  };
}

describe("costToUserRaw", () => {
  it("returns 0 for sponsor-paid quotes", () => {
    expect(costToUserRaw(mockQuote({ feePayer: "sponsor", fees: "100" }))).toBe(0n);
  });

  it("returns fees for user-paid quotes", () => {
    expect(costToUserRaw(mockQuote({ feePayer: "user", fees: "50" }))).toBe(50n);
  });
});

describe("effectiveReceiveRaw", () => {
  it("returns expectedOut when sponsor pays", () => {
    expect(
      effectiveReceiveRaw(mockQuote({ feePayer: "sponsor", expectedOut: "1000" }))
    ).toBe(1000n);
  });

  it("returns expectedOut minus fees when user pays", () => {
    expect(
      effectiveReceiveRaw(
        mockQuote({ feePayer: "user", expectedOut: "1000", fees: "10" })
      )
    ).toBe(990n);
  });
});

describe("sortByBest", () => {
  const exactInParams: SwapParams = {
    originChainId: 7565164,
    originToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    amount: "10000000",
    destinationChainId: 8453,
    destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    userAddress: "9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u",
    tradeType: "exact_in",
  };

  it("sorts by effective receive (desc) for exact_in", () => {
    const relay = mockQuote({
      provider: "relay",
      feePayer: "sponsor",
      expectedOut: "100",
      fees: "5",
    });
    const debridge = mockQuote({
      provider: "debridge",
      feePayer: "user",
      expectedOut: "102",
      fees: "5",
    });
    const sorted = sortByBest([debridge, relay], exactInParams);
    expect(effectiveReceiveRaw(sorted[0])).toBeGreaterThanOrEqual(effectiveReceiveRaw(sorted[1]));
    expect(sorted[0].provider).toBe("relay");
    expect(effectiveReceiveRaw(sorted[0])).toBe(100n);
    expect(effectiveReceiveRaw(sorted[1])).toBe(97n);
  });

  it("prefers Relay when effective receive is higher (sponsored)", () => {
    const relay = mockQuote({
      provider: "relay",
      feePayer: "sponsor",
      expectedOut: "100",
      fees: "10",
    });
    const debridge = mockQuote({
      provider: "debridge",
      feePayer: "user",
      expectedOut: "105",
      fees: "10",
    });
    const sorted = sortByBest([debridge, relay], exactInParams);
    expect(sorted[0].provider).toBe("relay");
    expect(effectiveReceiveRaw(sorted[0])).toBe(100n);
    expect(effectiveReceiveRaw(sorted[1])).toBe(95n);
  });

  it("tie-breaker: prefers Relay when within 0.1% of best", () => {
    const relay = mockQuote({
      provider: "relay",
      feePayer: "sponsor",
      expectedOut: "1000000",
      fees: "0",
    });
    const debridge = mockQuote({
      provider: "debridge",
      feePayer: "user",
      expectedOut: "1000100",
      fees: "100",
    });
    const sorted = sortByBest([debridge, relay], exactInParams);
    expect(effectiveReceiveRaw(debridge)).toBe(1000000n);
    expect(effectiveReceiveRaw(relay)).toBe(1000000n);
    expect(sorted[0].provider).toBe("relay");
  });
});

describe("getQuotes", () => {
  it("returns Relay quote with feePayer sponsor and sponsorCost set", async () => {
    const { getRelayQuote } = await import("@/lib/relay/quote");
    const { getDebridgeQuote } = await import("@/lib/debridge/quote");
    const relayQuote = mockQuote({
      provider: "relay",
      feePayer: "sponsor",
      sponsorCost: "500",
      expectedOut: "991000",
      expectedOutFormatted: "0.991",
      fees: "500",
      feeCurrency: "USDC",
      expiryAt: Date.now() + 30_000,
      raw: {},
    });
    vi.mocked(getRelayQuote).mockResolvedValue(relayQuote);
    vi.mocked(getDebridgeQuote).mockRejectedValue(new Error("debridge failed"));

    const params: SwapParams = {
      originChainId: 7565164,
      originToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amount: "10000000",
      destinationChainId: 8453,
      destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      userAddress: "9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u",
      tradeType: "exact_in",
    };

    const result = await getQuotes(params);
    expect(result.quotes.length).toBe(1);
    expect(result.best?.provider).toBe("relay");
    expect(result.best?.feePayer).toBe("sponsor");
    expect(result.best?.sponsorCost).toBe("500");
  });

  it("returns deBridge quote with feePayer user and solanaCostToUser when origin is Solana", async () => {
    const { getRelayQuote } = await import("@/lib/relay/quote");
    const { getDebridgeQuote } = await import("@/lib/debridge/quote");
    const debridgeQuote = mockQuote({
      provider: "debridge",
      feePayer: "user",
      sponsorCost: "0",
      solanaCostToUser: "15000000",
      expectedOut: "990000",
      fees: "1000",
      feeCurrency: "USDC",
      expiryAt: Date.now() + 30_000,
      raw: {},
    });
    vi.mocked(getRelayQuote).mockRejectedValue(new Error("relay failed"));
    vi.mocked(getDebridgeQuote).mockResolvedValue(debridgeQuote);

    const params: SwapParams = {
      originChainId: 7565164,
      originToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amount: "10000000",
      destinationChainId: 8453,
      destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      userAddress: "9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u",
      tradeType: "exact_in",
    };

    const result = await getQuotes(params);
    expect(result.quotes.length).toBe(1);
    expect(result.best?.provider).toBe("debridge");
    expect(result.best?.feePayer).toBe("user");
    expect(result.best?.sponsorCost).toBe("0");
    expect(result.best?.solanaCostToUser).toBe("15000000");
  });
});
