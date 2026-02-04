import { describe, it, expect, vi } from "vitest";
import type { NormalizedQuote, SwapParams } from "@/types/swap";
import {
  getQuotes,
  hasEnoughSolForQuote,
  isIllogicalRoute,
  minSolRequiredForQuote,
  NeedSolForGasError,
  sortByBest,
  costToUserRaw,
  effectiveReceiveRaw,
  netUserValueUsd,
  validateSponsorProfitability,
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
  it("returns userFee for sponsor-paid quotes when fee is USDC (Relay)", () => {
    expect(
      costToUserRaw(mockQuote({ feePayer: "sponsor", fees: "100", userFee: "2000000", userFeeCurrency: "USDC" }))
    ).toBe(BigInt("2000000"));
  });

  it("returns 0 for sponsor-paid quotes when fee is SOL (fee paid on Solana, not from destination)", () => {
    expect(
      costToUserRaw(mockQuote({ feePayer: "sponsor", userFee: "68802166", userFeeCurrency: "SOL" }))
    ).toBe(BigInt(0));
  });

  it("returns 0 for sponsor-paid quotes without userFee (backward compat)", () => {
    expect(costToUserRaw(mockQuote({ feePayer: "sponsor", fees: "100" }))).toBe(BigInt(0));
  });

  it("returns fees for user-paid quotes (deBridge)", () => {
    expect(costToUserRaw(mockQuote({ feePayer: "user", fees: "50" }))).toBe(BigInt("50"));
  });
});

describe("effectiveReceiveRaw", () => {
  it("returns expectedOut minus userFee when sponsor pays in USDC (Relay)", () => {
    expect(
      effectiveReceiveRaw(
        mockQuote({ feePayer: "sponsor", expectedOut: "1000", userFee: "20", userFeeCurrency: "USDC" })
      )
    ).toBe(BigInt("980"));
  });

  it("returns full expectedOut when sponsor pays in SOL (fee on Solana, user gets full destination amount)", () => {
    expect(
      effectiveReceiveRaw(
        mockQuote({ feePayer: "sponsor", expectedOut: "99861684", userFee: "68802166", userFeeCurrency: "SOL" })
      )
    ).toBe(BigInt("99861684"));
  });

  it("returns expectedOut when sponsor pays without userFee (backward compat)", () => {
    expect(
      effectiveReceiveRaw(mockQuote({ feePayer: "sponsor", expectedOut: "1000" }))
    ).toBe(BigInt("1000"));
  });

  it("returns expectedOut minus fees when user pays (deBridge)", () => {
    expect(
      effectiveReceiveRaw(
        mockQuote({ feePayer: "user", expectedOut: "1000", fees: "10" })
      )
    ).toBe(BigInt("990"));
  });
});

describe("netUserValueUsd", () => {
  it("calculates net value from USD fields", () => {
    const quote = mockQuote({
      userReceivesUsd: 100,
      userPaysUsd: 2,
      requiresSOL: false,
    });
    expect(netUserValueUsd(quote)).toBe(98);
  });

  it("subtracts SOL cost when requiresSOL is true", () => {
    const quote = mockQuote({
      userReceivesUsd: 100,
      userPaysUsd: 2,
      requiresSOL: true,
      solanaCostToUser: "15000000", // 0.015 SOL
      solPriceUsd: 150,
    });
    // 100 - 2 - (0.015 * 150) = 100 - 2 - 2.25 = 95.75
    expect(netUserValueUsd(quote)).toBeCloseTo(95.75, 2);
  });

  it("returns 0 when USD fields are missing", () => {
    const quote = mockQuote({});
    expect(netUserValueUsd(quote)).toBe(0);
  });
});

describe("validateSponsorProfitability", () => {
  it("validates Relay quotes using worst-case costs", () => {
    const quote = mockQuote({
      provider: "relay",
      feePayer: "sponsor",
      userFeeUsd: 3.0,
      worstCaseSponsorCostUsd: 2.5,
    });
    expect(validateSponsorProfitability(quote).valid).toBe(true);
  });

  it("rejects Relay quotes where userFee < worstCaseCost", () => {
    const quote = mockQuote({
      provider: "relay",
      feePayer: "sponsor",
      userFeeUsd: 2.0,
      worstCaseSponsorCostUsd: 2.5,
    });
    const result = validateSponsorProfitability(quote);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("does not cover worst-case costs");
  });

  it("always validates deBridge quotes (no sponsor costs)", () => {
    const quote = mockQuote({
      provider: "debridge",
      feePayer: "user",
    });
    expect(validateSponsorProfitability(quote).valid).toBe(true);
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
      userFee: "0", // No user fee for backward compat test
    });
    const debridge = mockQuote({
      provider: "debridge",
      feePayer: "user",
      expectedOut: "102",
      fees: "5",
    });
    const sorted = sortByBest([debridge, relay], exactInParams);
    const first = sorted[0];
    const second = sorted[1];
    if (!first || !second) throw new Error("Expected two quotes");
    expect(effectiveReceiveRaw(first)).toBeGreaterThanOrEqual(effectiveReceiveRaw(second));
    expect(first.provider).toBe("relay");
    expect(effectiveReceiveRaw(first)).toBe(BigInt("100"));
    expect(effectiveReceiveRaw(second)).toBe(BigInt("97"));
  });

  it("sorts by USD value when available", () => {
    const relay = mockQuote({
      provider: "relay",
      feePayer: "sponsor",
      expectedOut: "100",
      userFee: "2",
      userReceivesUsd: 100,
      userPaysUsd: 2,
    });
    const debridge = mockQuote({
      provider: "debridge",
      feePayer: "user",
      expectedOut: "102",
      fees: "5",
      userReceivesUsd: 102,
      userPaysUsd: 5,
    });
    const sorted = sortByBest([debridge, relay], exactInParams);
    const first = sorted[0];
    const second = sorted[1];
    if (!first || !second) {
      throw new Error("Expected two quotes");
    }
    expect(first.provider).toBe("relay");
    expect(netUserValueUsd(first)).toBeGreaterThan(netUserValueUsd(second));
  });

  it("prefers Relay when effective receive is higher (sponsored)", () => {
    const relay = mockQuote({
      provider: "relay",
      feePayer: "sponsor",
      expectedOut: "100",
      fees: "10",
      userFee: "0",
    });
    const debridge = mockQuote({
      provider: "debridge",
      feePayer: "user",
      expectedOut: "105",
      fees: "10",
    });
    const sorted = sortByBest([debridge, relay], exactInParams);
    const first = sorted[0];
    const second = sorted[1];
    if (!first || !second) throw new Error("Expected two quotes");
    expect(first.provider).toBe("relay");
    expect(effectiveReceiveRaw(first)).toBe(BigInt("100"));
    expect(effectiveReceiveRaw(second)).toBe(BigInt("95"));
  });

  it("tie-breaker: prefers Relay when within 0.1% of best", () => {
    const relay = mockQuote({
      provider: "relay",
      feePayer: "sponsor",
      expectedOut: "1000000",
      fees: "0",
      userFee: "0",
    });
    const debridge = mockQuote({
      provider: "debridge",
      feePayer: "user",
      expectedOut: "1000100",
      fees: "100",
    });
    const sorted = sortByBest([debridge, relay], exactInParams);
    expect(effectiveReceiveRaw(debridge)).toBe(BigInt("1000000"));
    expect(effectiveReceiveRaw(relay)).toBe(BigInt("1000000"));
    const first = sorted[0];
    if (!first) throw new Error("Expected at least one quote");
    expect(first.provider).toBe("relay");
  });
});

describe("minSolRequiredForQuote / hasEnoughSolForQuote", () => {
  it("deBridge: required = solanaCostToUser + 10% buffer", () => {
    const q = mockQuote({ provider: "debridge", solanaCostToUser: "15000000" });
    expect(minSolRequiredForQuote(q)).toBe(BigInt("16500000"));
    expect(hasEnoughSolForQuote(q, "10000000")).toBe(false);
    expect(hasEnoughSolForQuote(q, "16500000")).toBe(true);
    expect(hasEnoughSolForQuote(q, "20000000")).toBe(true);
  });

  it("Relay with SOL fee: required = userFee lamports", () => {
    const q = mockQuote({ provider: "relay", requiresSOL: true, userFee: "124709491" });
    expect(minSolRequiredForQuote(q)).toBe(BigInt("124709491"));
    expect(hasEnoughSolForQuote(q, "100000000")).toBe(false);
    expect(hasEnoughSolForQuote(q, "124709491")).toBe(true);
  });

  it("Relay without SOL fee: no SOL required", () => {
    const q = mockQuote({ provider: "relay", requiresSOL: false });
    expect(minSolRequiredForQuote(q)).toBe(null);
    expect(hasEnoughSolForQuote(q, "0")).toBe(true);
  });
});

describe("isIllogicalRoute", () => {
  it("returns true when same chain and same token", () => {
    expect(
      isIllogicalRoute({
        originChainId: 7565164,
        destinationChainId: 7565164,
        originToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        destinationToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "10000000",
        userAddress: "User111",
        tradeType: "exact_in",
      })
    ).toBe(true);
  });

  it("returns true when same chain and same token (case insensitive)", () => {
    expect(
      isIllogicalRoute({
        originChainId: 7565164,
        destinationChainId: 7565164,
        originToken: "epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v",
        destinationToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "10000000",
        userAddress: "User111",
        tradeType: "exact_in",
      })
    ).toBe(true);
  });

  it("returns false when same chain but different token", () => {
    expect(
      isIllogicalRoute({
        originChainId: 7565164,
        destinationChainId: 7565164,
        originToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        destinationToken: "So11111111111111111111111111111111111111112",
        amount: "10000000",
        userAddress: "User111",
        tradeType: "exact_in",
      })
    ).toBe(false);
  });

  it("returns false when cross-chain (different chain)", () => {
    expect(
      isIllogicalRoute({
        originChainId: 7565164,
        destinationChainId: 8453,
        originToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        destinationToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "10000000",
        userAddress: "User111",
        tradeType: "exact_in",
      })
    ).toBe(false);
  });
});

describe("getQuotes", () => {
  it("throws for illogical route (same token on same chain)", async () => {
    const params: SwapParams = {
      originChainId: 7565164,
      originToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amount: "10000000",
      destinationChainId: 7565164,
      destinationToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      userAddress: "9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u",
      tradeType: "exact_in",
    };
    await expect(getQuotes(params)).rejects.toThrow("Same token on same chain");
    const { getRelayQuote } = await import("@/lib/relay/quote");
    expect(getRelayQuote).not.toHaveBeenCalled();
  });

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

  it("same-chain swap: uses Relay only, does not call deBridge", async () => {
    const { getRelayQuote } = await import("@/lib/relay/quote");
    const { getDebridgeQuote } = await import("@/lib/debridge/quote");
    const relayQuote = mockQuote({
      provider: "relay",
      feePayer: "sponsor",
      sponsorCost: "200",
      expectedOut: "995000",
      expectedOutFormatted: "0.995",
      fees: "200",
      feeCurrency: "USDC",
      expiryAt: Date.now() + 30_000,
      raw: {},
    });
    vi.mocked(getRelayQuote).mockResolvedValue(relayQuote);
    vi.mocked(getDebridgeQuote).mockReset();

    const params: SwapParams = {
      originChainId: 7565164,
      originToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amount: "10000000",
      destinationChainId: 7565164,
      destinationToken: "So11111111111111111111111111111111111111112",
      userAddress: "9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u",
      tradeType: "exact_in",
    };

    const result = await getQuotes(params);
    expect(getDebridgeQuote).not.toHaveBeenCalled();
    expect(result.quotes.length).toBe(1);
    expect(result.best?.provider).toBe("relay");
  });

  it("cross-chain Solana origin with low SOL: both Relay and deBridge quotes returned (execution gated in UI)", async () => {
    const { getRelayQuote } = await import("@/lib/relay/quote");
    const { getDebridgeQuote } = await import("@/lib/debridge/quote");
    const relayQuote = mockQuote({
      provider: "relay",
      feePayer: "sponsor",
      sponsorCost: "500",
      expectedOut: "991000",
      fees: "500",
      feeCurrency: "USDC",
      expiryAt: Date.now() + 30_000,
      raw: {},
    });
    const debridgeQuote = mockQuote({
      provider: "debridge",
      feePayer: "user",
      solanaCostToUser: "15000000",
      expectedOut: "990000",
      fees: "1000",
      expiryAt: Date.now() + 30_000,
      raw: {},
    });
    vi.mocked(getRelayQuote).mockResolvedValue(relayQuote);
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
    const lowSolBalance = "1000";

    const result = await getQuotes(params, undefined, lowSolBalance);
    expect(getDebridgeQuote).toHaveBeenCalled();
    // Quotes shown regardless of SOL; execution is blocked in UI when insufficient
    expect(result.quotes.length).toBe(2);
    expect(result.best?.provider).toBe("relay");
  });

  it("returns deBridge quote when Relay fails even with zero SOL (quotes shown regardless of balance)", async () => {
    const { getRelayQuote } = await import("@/lib/relay/quote");
    const { getDebridgeQuote } = await import("@/lib/debridge/quote");
    const debridgeQuote = mockQuote({
      provider: "debridge",
      feePayer: "user",
      solanaCostToUser: "15000000",
      expectedOut: "990000",
      fees: "1000",
      expiryAt: Date.now() + 30_000,
      raw: {},
    });
    vi.mocked(getRelayQuote).mockRejectedValue(new Error("no routes found"));
    vi.mocked(getDebridgeQuote).mockResolvedValue(debridgeQuote);

    const params: SwapParams = {
      originChainId: 7565164,
      originToken: "So11111111111111111111111111111111111111112",
      amount: "10000000",
      destinationChainId: 8453,
      destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      userAddress: "9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u",
      tradeType: "exact_in",
    };
    const zeroSol = "0";

    const result = await getQuotes(params, undefined, zeroSol);
    expect(result.quotes.length).toBe(1);
    expect(result.best?.provider).toBe("debridge");
    // Execution would be blocked in UI for insufficient SOL; quote is still returned
  });

  it("cross-chain Solana origin with enough SOL: calls deBridge", async () => {
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
    const enoughSolBalance = "20000000";

    const result = await getQuotes(params, undefined, enoughSolBalance);
    expect(getDebridgeQuote).toHaveBeenCalledWith(params);
    expect(result.quotes.length).toBe(1);
    expect(result.best?.provider).toBe("debridge");
    expect(result.best?.feePayer).toBe("user");
    expect(result.best?.solanaCostToUser).toBe("15000000");
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

    const result = await getQuotes(params, undefined, "20000000");
    expect(result.quotes.length).toBe(1);
    expect(result.best?.provider).toBe("debridge");
    expect(result.best?.feePayer).toBe("user");
    expect(result.best?.sponsorCost).toBe("0");
    expect(result.best?.solanaCostToUser).toBe("15000000");
  });
});
