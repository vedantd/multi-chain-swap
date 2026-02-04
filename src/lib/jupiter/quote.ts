/**
 * Jupiter Ultra Swap API quote adapter.
 * Fetches same-chain Solana swap quotes and maps them to NormalizedQuote.
 * Only used when origin and destination are both Solana (Sol-to-Sol).
 */

import type { NormalizedQuote, SwapParams } from "@/types/swap";
import { CHAIN_ID_SOLANA } from "@/lib/chainConfig";
import { TOKENS_BY_CHAIN } from "@/lib/chainConfig";
import { formatRawAmountWithDecimals } from "@/lib/utils/formatting";

const JUPITER_ULTRA_BASE = "https://api.jup.ag/ultra/v1";

/** Known Solana mints to symbol for fee display */
const MINT_TO_SYMBOL: Record<string, string> = {
  So11111111111111111111111111111111111111112: "SOL",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
};

function feeMintToSymbol(feeMint: string): string {
  return MINT_TO_SYMBOL[feeMint] ?? "SOL";
}

function formatRawAmount(raw: string, decimals: number): string {
  return formatRawAmountWithDecimals(raw, Math.max(0, decimals));
}

interface JupiterOrderResponse {
  inAmount: string;
  outAmount: string;
  platformFee?: { amount: string; feeBps: number };
  feeMint?: string;
  feeBps?: number; // Top-level fee in basis points
  signatureFeeLamports?: number;
  signatureFeePayer?: string | null;
  prioritizationFeeLamports?: number;
  prioritizationFeePayer?: string | null;
  rentFeeLamports?: number;
  rentFeePayer?: string | null;
  gasless?: boolean;
  transaction?: string | null;
  requestId?: string;
  expireAt?: string;
  errorCode?: number;
  errorMessage?: string;
}

/**
 * Fetch a quote from Jupiter Ultra Swap API and normalize it.
 * Only valid for same-chain Solana (origin and destination = CHAIN_ID_SOLANA).
 */
export async function getJupiterQuote(params: SwapParams): Promise<NormalizedQuote> {
  if (params.originChainId !== CHAIN_ID_SOLANA || params.destinationChainId !== CHAIN_ID_SOLANA) {
    throw new Error("Jupiter quote is only for same-chain Solana swaps");
  }

  const apiKey = process.env.JUPITER_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("JUPITER_API_KEY is not set");
  }

  const url = new URL(`${JUPITER_ULTRA_BASE}/order`);
  url.searchParams.set("inputMint", params.originToken);
  url.searchParams.set("outputMint", params.destinationToken);
  url.searchParams.set("amount", params.amount);
  // Include taker when available for better quote data and transaction generation
  // Receiver is optional - only set if different from taker (Jupiter defaults receiver to taker)
  if (params.userAddress) {
    url.searchParams.set("taker", params.userAddress);
    // Only set receiver if it's different from taker (Jupiter API doesn't allow receiver === taker)
    if (params.recipientAddress && params.recipientAddress !== params.userAddress) {
      url.searchParams.set("receiver", params.recipientAddress);
    }
  }

  const requestUrl = url.toString();

  let res: Response;
  let data: JupiterOrderResponse;
  
  try {
    res = await fetch(requestUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      let errorMessage = `Jupiter order failed: ${res.status}`;
      try {
        const errorJson = JSON.parse(text);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = `${errorMessage} ${text || res.statusText}`;
      }
      // For 400 errors (bad request, no routes, etc.), treat as "no quotes available"
      // This prevents 502 errors for expected scenarios
      if (res.status === 400) {
        throw new Error(`No quotes available: ${errorMessage}`);
      }
      throw new Error(errorMessage);
    }

    data = (await res.json()) as JupiterOrderResponse;
  } catch (err) {
    // Handle network errors, JSON parsing errors, etc.
    if (err instanceof Error) {
      // If error already starts with "No quotes available", re-throw as-is
      if (err.message.startsWith("No quotes available")) {
        throw err;
      }
      // Re-throw with clearer message for network errors
      if (err.message.includes("fetch") || err.message.includes("network")) {
        throw new Error("Failed to connect to Jupiter API. Please try again.");
      }
      throw err;
    }
    throw new Error("Unexpected error fetching Jupiter quote");
  }

  // Handle Jupiter API error codes
  // Note: Jupiter can return errorCode even with a transaction (as a warning)
  // Only treat as error if there's no outAmount AND errorCode is set
  // Transaction can be null when taker is not provided (quote-only request)
  if (data.errorCode != null && (!data.outAmount || data.outAmount === "0")) {
    const errorMsg = data.errorMessage ?? `Jupiter error code ${data.errorCode}`;
    // Any errorCode without quote data means Jupiter couldn't find a route
    // This is an expected scenario (no routes, insufficient liquidity, etc.)
    // and should return empty quotes gracefully, not cause a 502 error
    throw new Error(`No quotes available: ${errorMsg}`);
  }

  // Check if we have valid quote data (outAmount)
  const outAmount = data.outAmount ?? "0";

  if (!outAmount || outAmount === "0") {
    console.error("[Jupiter] No quote data - outAmount is missing or zero");
    throw new Error("No quotes available: Jupiter returned no quote data (insufficient liquidity or no routes)");
  }

  // Transaction is optional - only needed for execution, not for quote fetching
  // When taker is not provided, transaction will be null, but quote data is still available
  const transaction = data.transaction?.trim() || null;

  const feeMint = data.feeMint ?? "So11111111111111111111111111111111111111112";
  const feeSymbol = feeMintToSymbol(feeMint) as "USDC" | "SOL";
  
  // Calculate platform fee - use amount if available, otherwise calculate from feeBps
  let platformFeeAmount = data.platformFee?.amount ?? "0";

  // If platformFee.amount is 0 or missing, try to calculate from feeBps
  if (platformFeeAmount === "0" || !platformFeeAmount) {
    const feeBps = data.platformFee?.feeBps ?? data.feeBps;
    if (feeBps != null && feeBps > 0) {
      const inputAmount = BigInt(params.amount);
      const calculatedFee = (inputAmount * BigInt(feeBps)) / BigInt(10000);
      platformFeeAmount = String(calculatedFee);
    }
  }

  // Fee deducted from output only when fee is in same token as destination
  const feeDeductedFromOutput = feeMint === params.destinationToken;
  // For Jupiter, fees are always shown - they're either deducted from output or paid separately
  // Set fees to platformFeeAmount so it's always displayed (even if 0)
  const feesForEffective = platformFeeAmount;

  const solanaTokens = TOKENS_BY_CHAIN[CHAIN_ID_SOLANA] ?? [];
  const destToken = solanaTokens.find(
    (t) => t.address === params.destinationToken
  );
  // Use token from config if found, otherwise fall back to MINT_TO_SYMBOL for known tokens
  const destDecimals = destToken?.decimals ?? (MINT_TO_SYMBOL[params.destinationToken] === "USDC" || MINT_TO_SYMBOL[params.destinationToken] === "USDT" ? 6 : 9);
  const destTokenSymbol = destToken?.symbol ?? MINT_TO_SYMBOL[params.destinationToken] ?? "USDC";
  const expectedOutFormatted = formatRawAmount(outAmount, destDecimals);

  // Fee payer info is available when taker is provided (even if transaction is null)
  // Calculate SOL costs based on fee payer information from the API
  // For Jupiter, always calculate SOL costs if fee payer info is available
  let solanaCostToUser: string | undefined;

  if (params.userAddress) {
    const taker = params.userAddress;
    const userPaysSignature =
      data.signatureFeePayer == null || data.signatureFeePayer === taker;
    const userPaysPrio =
      data.prioritizationFeePayer == null || data.prioritizationFeePayer === taker;
    const userPaysRent =
      data.rentFeePayer == null || data.rentFeePayer === taker;
    const sigLamports = Number(data.signatureFeeLamports) || 0;
    const prioLamports = Number(data.prioritizationFeeLamports) || 0;
    const rentLamports = Number(data.rentFeeLamports) || 0;
    const totalLamports = (userPaysSignature ? sigLamports : 0) + (userPaysPrio ? prioLamports : 0) + (userPaysRent ? rentLamports : 0);

    // Always set solanaCostToUser - use actual value or "0" if gasless
    if (data.gasless) {
      solanaCostToUser = "0"; // Gasless means no SOL costs
    } else {
      solanaCostToUser = totalLamports > 0 ? String(totalLamports) : "5000"; // Default estimate if 0
    }
  } else {
    // If no taker, estimate SOL costs (Jupiter typically charges ~5000 lamports base + priority)
    // This is a fallback for quote-only requests
    solanaCostToUser = data.gasless ? "0" : "5000"; // Rough estimate for display
  }

  let expiryAt = Date.now() + 60_000;
  if (data.expireAt) {
    const parsed = Date.parse(data.expireAt);
    if (Number.isFinite(parsed)) expiryAt = parsed;
  }

  // Always set userFee to platformFeeAmount so fees are displayed
  // For Jupiter, platformFee is the swap fee (relayer fee)
  // The fee currency is determined by feeMint (what token the fee is paid in)
  const userFeeAmount = platformFeeAmount;

  const normalizedQuote: NormalizedQuote = {
    provider: "jupiter",
    expectedOut: outAmount,
    expectedOutFormatted,
    fees: feesForEffective, // Platform fee amount (swap/relayer fee)
    feeCurrency: destTokenSymbol, // Use destination token symbol for consistency
    feePayer: "user",
    sponsorCost: "0",
    userFee: userFeeAmount, // Platform fee (swap fee) - always set for display
    userFeeCurrency: feeSymbol, // Fee mint symbol (USDC, SOL, etc.) - what token the fee is paid in
    gasless: data.gasless === true,
    // Jupiter requires SOL for network fees (signature + priority) unless gasless
    requiresSOL: !data.gasless && (solanaCostToUser ? BigInt(solanaCostToUser) > BigInt(0) : true),
    solanaCostToUser, // SOL costs for network fees (signature + priority + rent)
    expiryAt,
    raw: {
      ...data,
      transaction: transaction || undefined,
      requestId: data.requestId,
    },
  };

  return normalizedQuote;
}
