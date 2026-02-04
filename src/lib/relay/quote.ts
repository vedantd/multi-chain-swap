// External dependencies
import type { Connection } from "@solana/web3.js";

// Internal types
import type { NormalizedQuote, SwapParams } from "@/types/swap";

// Internal utilities/lib functions
import { CHAIN_ID_SOLANA, ESTIMATED_SOLANA_TX_LAMPORTS, toRelayChainId, TOKENS_BY_CHAIN } from "@/lib/chainConfig";
import { DEFAULT_DEPOSIT_FEE_PAYER, QUOTE_VALIDITY_MS } from "@/lib/constants";
import { getSolPriceInUsdc, getTokenPriceUsd, lamportsToUsdc } from "@/lib/pricing";
import { detectToken2022 } from "@/lib/solana/tokenDetection";
import { getAtaExists, getSolBalance, getTokenBalance } from "@/lib/solana/balance";

interface RelayFeeItem {
  amount?: string | number;
  amountFormatted?: string;
  amountUsd?: string;
  currency?: { symbol?: string; address?: string; decimals?: number };
}

interface RelayDetails {
  currencyOut?: RelayFeeItem;
  timeEstimate?: number;
}

interface RelayQuoteResponse {
  steps?: unknown[];
  fees?: {
    gas?: RelayFeeItem;
    relayer?: RelayFeeItem;
    relayerGas?: RelayFeeItem;
    relayerService?: RelayFeeItem;
    app?: RelayFeeItem;
    subsidized?: RelayFeeItem;
  };
  details?: RelayDetails;
}

/** Sum only fee items in the same currency (avoid mixing ETH wei with USDC raw) */
function sumFeeAmountsInCurrency(
  items: (RelayFeeItem | undefined)[],
  currencySymbol: string
): string {
  let total = BigInt(0);
  for (const item of items) {
    if (item?.amount == null) continue;
    const symbol = item.currency?.symbol;
    if (symbol !== currencySymbol) continue;
    total += BigInt(String(item.amount));
  }
  return String(total);
}

function getFeeCurrency(items: (RelayFeeItem | undefined)[]): string {
  const withCurrency = items.find((i) => i?.currency?.symbol);
  return withCurrency?.currency?.symbol ?? "USDC";
}

/** Price drift percentage (2%) - accounts for quote volatility in worst-case cost calculation. */
export const PRICE_DRIFT_PERCENTAGE = 0.02; // 2%

interface WorstCaseCosts {
  gasUsd: number;
  rentUsd: number;
  tokenLossUsd: number; // Token-2022 transfer fees
  driftBufferUsd: number; // Quote drift (0.5% of swap value)
  failureBufferUsd: number; // Failed tx retry costs (2x gas)
}

export async function calculateWorstCaseCosts(
  params: SwapParams,
  expectedOutUsd: number,
  solPriceUsd: number,
  connection?: Connection,
  depositFeePayer?: string
): Promise<WorstCaseCosts> {
  // Validate inputs
  if (!Number.isFinite(solPriceUsd) || solPriceUsd <= 0) {
    throw new Error(`Invalid solPriceUsd: ${solPriceUsd}`);
  }
  if (!Number.isFinite(expectedOutUsd) || expectedOutUsd < 0) {
    throw new Error(`Invalid expectedOutUsd: ${expectedOutUsd}`);
  }

  const gasLamports = BigInt(ESTIMATED_SOLANA_TX_LAMPORTS);
  const gasUsd = (Number(gasLamports) / 1e9) * solPriceUsd;

  const ataRentLamports = 2_039_280;
  let rentUsd: number;
  if (params.originChainId !== CHAIN_ID_SOLANA) {
    rentUsd = 0;
  } else if (depositFeePayer === params.userAddress) {
    rentUsd = 0;
  } else if (connection && depositFeePayer) {
    try {
      const ataExists = await getAtaExists(connection, depositFeePayer, params.originToken);
      rentUsd = ataExists ? 0 : (ataRentLamports / 1e9) * solPriceUsd;
    } catch {
      rentUsd = (ataRentLamports / 1e9) * solPriceUsd;
    }
  } else {
    rentUsd = (ataRentLamports / 1e9) * solPriceUsd;
  }

  // Token-2022 transfer fees
  let tokenLossUsd = 0;
  if (connection && params.originChainId === CHAIN_ID_SOLANA && expectedOutUsd > 0) {
    try {
      const tokenInfo = await detectToken2022(connection, params.originToken);
      if (tokenInfo.hasTransferFees && tokenInfo.transferFeeBps != null && tokenInfo.transferFeeBps > 0 && tokenInfo.transferFeeBps < 10000) {
        // Calculate transfer fee in USD
        const feeBps = tokenInfo.transferFeeBps;
        const inputAmountUsd = expectedOutUsd / (1 - feeBps / 10000);
        tokenLossUsd = inputAmountUsd * (feeBps / 10000);
        // Ensure tokenLossUsd is finite and non-negative
        if (!Number.isFinite(tokenLossUsd) || tokenLossUsd < 0) {
          tokenLossUsd = 0;
        }
      }
    } catch {
      // Ignore errors in token detection
      tokenLossUsd = 0;
    }
  }

  // Quote drift buffer: 2% of swap value (hard-coded as per requirements)
  // Price drift accounts for quote volatility between quote time and execution time.
  // The 2% buffer protects against adverse price movements that could reduce the
  // actual swap value below the quoted amount.
  //
  // Only apply drift buffer if expectedOutUsd > 0 to avoid invalid calculations.
  // This drift buffer is included in worstCaseSponsorCostUsd, which then has
  // a 20% margin applied in selectUserFee() to ensure sponsor profitability.
  const driftBufferUsd = expectedOutUsd > 0 
    ? expectedOutUsd * PRICE_DRIFT_PERCENTAGE 
    : 0;
  
  // Ensure driftBufferUsd is finite and non-negative
  if (!Number.isFinite(driftBufferUsd) || driftBufferUsd < 0) {
    throw new Error(`Invalid driftBufferUsd calculated: ${driftBufferUsd} from expectedOutUsd: ${expectedOutUsd}`);
  }

  // Failure buffer: 2x gas (retry scenario)
  const failureBufferUsd = gasUsd * 2;

  // Validate all outputs are finite and non-negative
  const result = {
    gasUsd,
    rentUsd,
    tokenLossUsd,
    driftBufferUsd,
    failureBufferUsd,
  };

  // Validate all values are finite
  if (!Object.values(result).every(v => Number.isFinite(v) && v >= 0)) {
    throw new Error(`Invalid worst-case costs calculated: ${JSON.stringify(result)}`);
  }

  return result;
}

interface FeeSelection {
  userFee: string;
  userFeeCurrency: "USDC" | "SOL";
  requiresSOL: boolean;
  userFeeUsd: number;
}

interface BalanceOverrides {
  userSolBalance?: string;
  userUsdcBalance?: string; // Solana USDC balance when destination is Solana
}

async function selectUserFee(
  worstCaseCostUsd: number,
  userAddress: string,
  destinationToken: string,
  destinationChainId: number,
  solPriceUsd: number,
  connection?: Connection,
  balanceOverrides?: BalanceOverrides
): Promise<FeeSelection> {
  // Apply 20% margin to worst-case costs to ensure sponsor profitability.
  // Note: worstCaseCostUsd already includes driftBufferUsd (2% price drift),
  // so the margin is applied AFTER drift is accounted for.
  // This ensures: userFeeUsd = (gas + rent + tokenLoss + drift + failure) * 1.20
  const marginBps = 2000; // 20%
  const feeUsdRequired = worstCaseCostUsd * (1 + marginBps / 10000);

  // Get user balances: from connection when available, else from client-provided overrides
  let userSolBalance: string | null = balanceOverrides?.userSolBalance ?? null;
  let userUsdcBalance: string | null = balanceOverrides?.userUsdcBalance ?? null;

  if (connection) {
    try {
      userSolBalance = await getSolBalance(connection, userAddress);
      if (destinationChainId === CHAIN_ID_SOLANA) {
        userUsdcBalance = await getTokenBalance(connection, userAddress, destinationToken);
      }
    } catch {
      // Ignore balance check errors
    }
  }

  // Try USDC first
  const feeUsdcRaw = Math.ceil(feeUsdRequired * 1e6); // Convert to USDC raw
  if (userUsdcBalance && BigInt(userUsdcBalance) >= BigInt(feeUsdcRaw)) {
    return {
      userFee: String(feeUsdcRaw),
      userFeeCurrency: "USDC",
      requiresSOL: false,
      userFeeUsd: feeUsdRequired,
    };
  }

  // Fallback to SOL
  const feeSolAmount = feeUsdRequired / solPriceUsd;
  const feeSolLamports = Math.ceil(feeSolAmount * 1e9);
  const feeSolLamportsWithBuffer = Math.ceil(feeSolLamports * 1.1); // 10% buffer

  if (userSolBalance && BigInt(userSolBalance) >= BigInt(feeSolLamportsWithBuffer)) {
    return {
      userFee: String(feeSolLamportsWithBuffer),
      userFeeCurrency: "SOL",
      requiresSOL: true,
      userFeeUsd: feeUsdRequired,
    };
  }

  // Neither available - route not eligible (will be filtered in eligibility check)
  // Return SOL fee anyway, eligibility filter will catch it
  return {
    userFee: String(feeSolLamportsWithBuffer),
    userFeeCurrency: "SOL",
    requiresSOL: true,
    userFeeUsd: feeUsdRequired,
  };
}

export interface RelayQuoteBalanceOverrides {
  userSOLBalance?: string;
  userSolanaUSDCBalance?: string;
}

/**
 * Fetch a quote from Relay API and normalize it for the application.
 * 
 * IMPORTANT: Quote Freshness
 * - Quotes are revalidated when being filled - keep quotes as fresh as possible
 * - Always re-quote before execution (see SwapPanel.tsx handleExecute)
 * - Check quote expiry before execution
 * 
 * Based on Relay Bridging Integration Guide:
 * https://docs.relay.link/bridging-integration-guide
 * 
 * @param params - Swap parameters (chains, tokens, amounts, addresses)
 * @param connection - Optional Solana connection for balance checks and token detection
 * @param balanceOverrides - Optional balance overrides to avoid RPC calls
 * @returns Promise resolving to normalized quote
 * @throws Error if Relay API request fails or response is invalid
 */
export async function getRelayQuote(
  params: SwapParams,
  connection?: Connection,
  balanceOverrides?: RelayQuoteBalanceOverrides
): Promise<NormalizedQuote> {
  const baseUrl = process.env.RELAY_API_URL ?? "https://api.relay.link";
  const url = `${baseUrl.replace(/\/$/, "")}/quote/v2`;

  const tradeType =
    params.tradeType === "exact_in" ? "EXACT_INPUT" : "EXACT_OUTPUT";

  const recipient = params.recipientAddress ?? params.userAddress;
  
  // NOTE: Fee Sponsorship and depositFeePayer
  // Relay fee sponsorship (covering destination chain fees via `subsidizeFees` and `subsidizeRent`)
  // requires Enterprise Partnership. The `depositFeePayer` parameter for Solana origin transactions
  // can use any Solana address (doesn't require Enterprise Partnership), but that address must
  // have sufficient SOL to cover transaction fees and rent.
  //
  // When `depositFeePayer` is set to user address:
  // - User pays their own Solana transaction fees
  // - No Enterprise Partnership required
  //
  // When `depositFeePayer` is set to sponsor address:
  // - Sponsor pays Solana transaction fees (from that wallet's SOL balance)
  // - Still requires Enterprise Partnership for `subsidizeFees`/`subsidizeRent` (destination fees)
  //
  // Fallback order: params.depositFeePayer → env vars → DEFAULT_DEPOSIT_FEE_PAYER
  // See: https://docs.relay.link/features/fee-sponsorship
  const depositFeePayer =
    params.depositFeePayer ??
    process.env.RELAY_DEPOSIT_FEE_PAYER ??
    process.env.SPONSOR_SOLANA_ADDRESS ??
    DEFAULT_DEPOSIT_FEE_PAYER;

  // Quote request body matches Relay API schema (relayapi.md lines 31-70, 285-295).
  // Required: user, recipient, originChainId, destinationChainId, originCurrency, destinationCurrency, amount, tradeType.
  // Solana origin: depositFeePayer (string) is set below. Optional: slippageTolerance, refundTo, referrer, topupGas, useExternalLiquidity, appFees.
  const body: Record<string, unknown> = {
    user: params.userAddress,
    recipient,
    originChainId: toRelayChainId(params.originChainId),
    destinationChainId: toRelayChainId(params.destinationChainId),
    originCurrency: params.originToken,
    destinationCurrency: params.destinationToken,
    amount: params.amount,
    tradeType,
  };
  
  // Solana-specific: depositFeePayer for Solana origin transactions
  if (params.originChainId === CHAIN_ID_SOLANA && depositFeePayer) {
    body.depositFeePayer = depositFeePayer;
  }
  
  // Optional Relay quote parameters (from Bridging Integration Guide)
  // https://docs.relay.link/bridging-integration-guide#quote-parameters
  
  // Slippage tolerance in basis points (e.g., "50" for 0.5%)
  if (params.slippageTolerance != null) {
    body.slippageTolerance = params.slippageTolerance;
  }
  
  // Refund address (defaults to user address if not specified)
  if (params.refundTo != null) {
    body.refundTo = params.refundTo;
  }
  
  // Referrer identifier for monitoring transactions (can be set via env var)
  const referrer = params.referrer ?? process.env.RELAY_REFERRER;
  if (referrer != null) {
    body.referrer = referrer;
  }
  
  if (params.topupGas === true) {
    body.topupGas = true;
    if (params.topupGasAmount != null) {
      body.topupGasAmount = params.topupGasAmount;
    }
  }
  
  if (params.useExternalLiquidity === true) {
    body.useExternalLiquidity = true;
  }
  
  if (params.appFees != null && Array.isArray(params.appFees) && params.appFees.length > 0) {
    body.appFees = params.appFees;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      console.error("[Relay] Error", res.status, text.slice(0, 500));
      let message = `Relay quote failed: ${res.status}`;
      try {
        const json = JSON.parse(text) as { message?: string; error?: string; errorCode?: string };
        message = json.message ?? json.error ?? message;
        if (json.errorCode === "NO_SWAP_ROUTES_FOUND") {
          const isSameChain = params.originChainId === params.destinationChainId;
          message = isSameChain
            ? "No swap routes available for this token pair on Solana. Relay may not have liquidity for this pair or amount—try a different amount or pair."
            : "No swap routes found for this route. Try a different amount or destination.";
        }
      } catch {
        if (text) message = text.slice(0, 200);
      }
      throw new Error(message);
    }

    const data = (await res.json()) as RelayQuoteResponse;
    const expiryAt = Date.now() + QUOTE_VALIDITY_MS;

    const fees = data.fees;
    const feeItems = [
      fees?.gas,
      fees?.relayer,
      fees?.relayerGas,
      fees?.relayerService,
      fees?.app,
    ].filter(Boolean);
    const outputCurrencySymbol = data.details?.currencyOut?.currency?.symbol;
    const feeCurrency =
      outputCurrencySymbol ?? getFeeCurrency(feeItems);
    const totalFeeAmount = sumFeeAmountsInCurrency(feeItems, feeCurrency);

    const currencyOut = data.details?.currencyOut;
    const expectedOut = currencyOut?.amount != null ? String(currencyOut.amount) : "0";
    const expectedOutFormatted = currencyOut?.amountFormatted != null ? String(currencyOut.amountFormatted) : "0";
    const timeEstimateSeconds = data.details?.timeEstimate;

    // Get destination token decimals for USD conversion
    const destinationTokens = TOKENS_BY_CHAIN[params.destinationChainId] ?? [];
    const destinationToken = destinationTokens.find(
      (t) => t.address.toLowerCase() === params.destinationToken.toLowerCase()
    );
    const destinationDecimals = destinationToken?.decimals ?? 6;

    // Calculate worst-case costs and user fee (only for Solana origin when sponsoring)
    let worstCaseSponsorCostUsd = 0;
    let userFee = "0";
    let userFeeCurrency: "USDC" | "SOL" = "USDC";
    let userFeeUsd = 0;
    let gasless = false;
    let requiresSOL = false;
    let solPriceUsd = 0;
    let userReceivesUsd = 0;
    let userPaysUsd = 0;

    if (params.originChainId === CHAIN_ID_SOLANA && depositFeePayer) {
      gasless = true;
      try {
        solPriceUsd = await getSolPriceInUsdc();
        if (!Number.isFinite(solPriceUsd) || solPriceUsd <= 0) {
          console.error("[Relay] Invalid solPriceUsd:", solPriceUsd);
          solPriceUsd = 150;
        }

        let tokenPrice = 0;
        try {
          tokenPrice = await getTokenPriceUsd(params.destinationToken, params.destinationChainId);
        } catch (e) {
          console.warn("[Relay] getTokenPriceUsd failed, using 1:", e);
        }
        if (!Number.isFinite(tokenPrice) || tokenPrice <= 0) {
          tokenPrice = 1;
        }

        const expectedOutNum = Number(expectedOut);
        const safeExpectedOutNum = Number.isFinite(expectedOutNum) && expectedOutNum >= 0 ? expectedOutNum : 0;
        userReceivesUsd = (safeExpectedOutNum / 10 ** destinationDecimals) * tokenPrice;
        if (!Number.isFinite(userReceivesUsd) || userReceivesUsd < 0) {
          userReceivesUsd = 0;
        }

        const worstCaseCosts = await calculateWorstCaseCosts(
          params,
          userReceivesUsd,
          solPriceUsd,
          connection,
          depositFeePayer
        );
        worstCaseSponsorCostUsd =
          worstCaseCosts.gasUsd +
          worstCaseCosts.rentUsd +
          worstCaseCosts.tokenLossUsd +
          worstCaseCosts.driftBufferUsd +
          worstCaseCosts.failureBufferUsd;

        const feeSelection = await selectUserFee(
          worstCaseSponsorCostUsd,
          params.userAddress,
          params.destinationToken,
          params.destinationChainId,
          solPriceUsd,
          connection,
          balanceOverrides
            ? {
                userSolBalance: balanceOverrides.userSOLBalance,
                userUsdcBalance: balanceOverrides.userSolanaUSDCBalance,
              }
            : undefined
        );

        userFee = feeSelection.userFee;
        userFeeCurrency = feeSelection.userFeeCurrency;
        userFeeUsd = feeSelection.userFeeUsd;
        requiresSOL = feeSelection.requiresSOL;

        if (feeSelection.userFeeCurrency === "USDC") {
          userPaysUsd = feeSelection.userFeeUsd;
        } else {
          userPaysUsd = (Number(feeSelection.userFee) / 1e9) * solPriceUsd;
        }
      } catch (err) {
        console.error("[Relay] Solana-origin fee calculation failed, using safe defaults:", err);
        worstCaseSponsorCostUsd = 0;
        userFeeUsd = 0;
        userFee = "0";
        userFeeCurrency = "USDC";
        requiresSOL = false;
      }
    }

    return {
      provider: "relay",
      expectedOut,
      expectedOutFormatted,
      fees: totalFeeAmount,
      feeCurrency,
      feePayer: "sponsor" as const,
      sponsorCost: totalFeeAmount,
      recoupedSponsorCost: totalFeeAmount,
      worstCaseSponsorCostUsd,
      userFee,
      userFeeCurrency,
      userFeeUsd,
      gasless,
      requiresSOL,
      userReceivesUsd,
      userPaysUsd,
      solPriceUsd: solPriceUsd > 0 ? solPriceUsd : undefined,
      // Include price drift in quote metadata only when:
      // 1. Origin is Solana (where we calculate worst-case costs)
      // 2. depositFeePayer is set (indicating sponsorship scenario)
      // Price drift is always included in worst-case cost calculations when expectedOutUsd > 0,
      // but only exposed in quote metadata for Solana origin + sponsor scenarios.
      priceDrift: params.originChainId === CHAIN_ID_SOLANA && depositFeePayer ? PRICE_DRIFT_PERCENTAGE : undefined,
      expiryAt,
      raw: data,
      timeEstimateSeconds,
      // Store slippage tolerance if provided (for quote tracking and re-quoting)
      slippageTolerance: params.slippageTolerance,
    };
  } finally {
    clearTimeout(timeout);
  }
}
