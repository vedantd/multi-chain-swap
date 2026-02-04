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
  if (connection && params.originChainId === CHAIN_ID_SOLANA) {
    try {
      const tokenInfo = await detectToken2022(connection, params.originToken);
      if (tokenInfo.hasTransferFees && tokenInfo.transferFeeBps) {
        // Calculate transfer fee in USD
        const inputAmountUsd = expectedOutUsd / (1 - tokenInfo.transferFeeBps / 10000);
        tokenLossUsd = inputAmountUsd * (tokenInfo.transferFeeBps / 10000);
      }
    } catch {
      // Ignore errors in token detection
    }
  }

  // Quote drift buffer: 2% of swap value (hard-coded as per requirements)
  const driftBufferUsd = expectedOutUsd * PRICE_DRIFT_PERCENTAGE;

  // Failure buffer: 2x gas (retry scenario)
  const failureBufferUsd = gasUsd * 2;

  return { gasUsd, rentUsd, tokenLossUsd, driftBufferUsd, failureBufferUsd };
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
  const depositFeePayer =
    params.depositFeePayer ??
    process.env.RELAY_DEPOSIT_FEE_PAYER ??
    process.env.SPONSOR_SOLANA_ADDRESS ??
    DEFAULT_DEPOSIT_FEE_PAYER;

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
  if (params.originChainId === CHAIN_ID_SOLANA && depositFeePayer) {
    body.depositFeePayer = depositFeePayer;
  }

  console.log("[Relay] POST", url, "body:", JSON.stringify(body, null, 2));

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
    console.log("[Relay] Success, steps:", data.steps?.length ?? 0, "details:", !!data.details);
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
      solPriceUsd = await getSolPriceInUsdc();
      const tokenPrice = await getTokenPriceUsd(params.destinationToken, params.destinationChainId);
      userReceivesUsd = (Number(expectedOut) / 10 ** destinationDecimals) * tokenPrice;

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

      // Calculate userPaysUsd
      if (feeSelection.userFeeCurrency === "USDC") {
        userPaysUsd = feeSelection.userFeeUsd;
      } else {
        // SOL fee - convert to USD
        userPaysUsd = (Number(feeSelection.userFee) / 1e9) * solPriceUsd;
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
      priceDrift: params.originChainId === CHAIN_ID_SOLANA && depositFeePayer ? PRICE_DRIFT_PERCENTAGE : undefined,
      expiryAt,
      raw: data,
      timeEstimateSeconds,
    };
  } finally {
    clearTimeout(timeout);
  }
}
