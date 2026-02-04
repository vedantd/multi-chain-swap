// Internal types
import type { NormalizedQuote, SwapParams } from "@/types/swap";

// Internal utilities/lib functions
import {
  CHAIN_ID_SOLANA,
  ESTIMATED_SOLANA_TX_LAMPORTS,
  isEvmChain,
  TOKENS_BY_CHAIN,
  toDebridgeChainId,
} from "@/lib/chainConfig";
import { QUOTE_VALIDITY_MS } from "@/lib/constants";
import { normalizeTokenAddress } from "@/lib/utils/address";
import { formatRawAmountWithDecimals } from "@/lib/utils/formatting";

const DEBRIDGE_API_BASE = "https://api.dln.trade";

function getDestinationDecimals(chainId: number, tokenAddress: string): number | undefined {
  const list = TOKENS_BY_CHAIN[chainId];
  if (!list?.length) return undefined;
  const key = normalizeTokenAddress(tokenAddress);
  const token = list.find((t) => normalizeTokenAddress(t.address) === key);
  return token?.decimals;
}

interface DebridgeCreateTxResponse {
  estimation?: {
    takeAmount?: string;
    takeAmountFormatted?: string;
    [key: string]: unknown;
  };
  order?: {
    takeOffer?: { amount?: string };
    [key: string]: unknown;
  };
  fixFee?: string;
  protocolFee?: string;
  tx?: unknown;
  orderId?: string;
  [key: string]: unknown;
}

function bigIntAdd(a: string, b: string): string {
  try {
    return String(BigInt(a) + BigInt(b));
  } catch {
    return a;
  }
}

/**
 * Fetch a quote from deBridge DLN API and normalize it for the application.
 * 
 * @param params - Swap parameters (chains, tokens, amounts, addresses)
 * @returns Promise resolving to normalized quote
 * @throws Error if deBridge API request fails or response is invalid
 */
export async function getDebridgeQuote(
  params: SwapParams
): Promise<NormalizedQuote> {
  const baseUrl = process.env.DEBRIDGE_API_URL ?? DEBRIDGE_API_BASE;
  const path = `${baseUrl.replace(/\/$/, "")}/v1.0/dln/order/create-tx`;

  const searchParams = new URLSearchParams();
  searchParams.set("srcChainId", toDebridgeChainId(params.originChainId));
  searchParams.set("srcChainTokenIn", params.originToken);
  searchParams.set("srcChainTokenInAmount", params.amount);
  searchParams.set("dstChainId", toDebridgeChainId(params.destinationChainId));
  searchParams.set("dstChainTokenOut", params.destinationToken);
  searchParams.set(
    "dstChainTokenOutAmount",
    params.tradeType === "exact_out" ? params.amount : "auto"
  );
  
  // Determine the correct destination address format based on chain type
  // For EVM destinations, use recipientAddress (EVM format); for Solana, use userAddress
  const isDestinationEvm = isEvmChain(params.destinationChainId);
  let dstAddress: string;
  if (isDestinationEvm) {
    if (!params.recipientAddress) {
      throw new Error("recipientAddress (EVM address) required for EVM destinations");
    }
    dstAddress = params.recipientAddress;
  } else {
    dstAddress = params.userAddress; // Solana destination uses Solana address
  }
  
  if (dstAddress) {
    searchParams.set("dstChainTokenOutRecipient", dstAddress);
  }
  
  searchParams.set("senderAddress", params.userAddress);
  // Ensure the user can always cancel and reclaim funds by default.
  searchParams.set("srcAllowedCancelBeneficiary", params.userAddress);
  searchParams.set(
    "dstChainOrderAuthorityAddress",
    dstAddress
  );

  // Make operating expenses explicit and transparent, as recommended by deBridge.
  searchParams.set("prependOperatingExpenses", "true");

  const url = `${path}?${searchParams.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      console.error("[deBridge] Error", res.status, text.slice(0, 500));
      let message = `deBridge quote failed: ${res.status}`;
      try {
        const json = JSON.parse(text) as { errorMessage?: string; errorId?: string };
        message = json.errorMessage ?? message;
        if (json.errorId === "ERROR_LOW_GIVE_AMOUNT") {
          message = "Amount too small for cross-chain swap; try at least ~$10 USDC (e.g. 10000000).";
        } else if (res.status === 500 && json.errorId === "INTERNAL_SERVER_ERROR") {
          message =
            "Provider temporarily unavailable or route not supported. Try a larger amount (e.g. 10000000 for 10 USDC) or a different destination.";
        }
      } catch {
        if (text) message = text.slice(0, 200);
      }
      throw new Error(message);
    }

    const data = (await res.json()) as DebridgeCreateTxResponse;
    const expiryAt = Date.now() + QUOTE_VALIDITY_MS;

    const estimation = data.estimation as {
      dstChainTokenOut?: { amount?: string; decimals?: number; approximateUsdValue?: number };
      srcChainTokenIn?: { approximateOperatingExpense?: string; amount?: string; [key: string]: unknown };
      takeAmount?: string;
      takeAmountFormatted?: string;
      [key: string]: unknown;
    } | undefined;
    const order = data.order;
    
    // Expected output is in estimation.dstChainTokenOut.amount (token smallest units; decimals in response).
    const dstTokenOut = estimation?.dstChainTokenOut;
    const expectedOut =
      dstTokenOut?.amount != null
        ? String(dstTokenOut.amount)
        : estimation?.takeAmount != null
          ? String(estimation.takeAmount)
          : order?.takeOffer?.amount != null
            ? String(order.takeOffer.amount)
            : "0";

    // Prefer API's human-readable takeAmountFormatted when it looks sane (avoids wrong decimals).
    const apiFormatted = estimation?.takeAmountFormatted != null ? String(estimation.takeAmountFormatted).trim() : null;
    const parsedApi = apiFormatted != null ? parseFloat(apiFormatted) : NaN;
    const useApiFormatted = Number.isFinite(parsedApi) && parsedApi >= 1e-12 && parsedApi <= 1e15;

    let expectedOutFormatted: string;
    if (useApiFormatted && apiFormatted != null) {
      expectedOutFormatted = apiFormatted;
    } else {
      // Use API's decimals so formatted amount matches. Fallback to our config.
      let dstDecimals: number | undefined =
        typeof dstTokenOut?.decimals === "number" && dstTokenOut.decimals >= 0
          ? dstTokenOut.decimals
          : getDestinationDecimals(params.destinationChainId, params.destinationToken);
      const rawBig = BigInt(expectedOut);
      const overrideDecimals = dstDecimals != null && dstDecimals < 18 && rawBig >= BigInt(10) ** BigInt(13);
      if (overrideDecimals) {
        dstDecimals = 18;
      }
      expectedOutFormatted =
        expectedOut !== "0" && dstDecimals != null
          ? formatRawAmountWithDecimals(expectedOut, dstDecimals)
          : apiFormatted ?? expectedOut;
    }

    const fixFee = data.fixFee != null ? String(data.fixFee) : "0";
    const protocolFee = data.protocolFee != null ? String(data.protocolFee) : "0";
    const totalFees = bigIntAdd(fixFee, protocolFee);

    // Extract operating expense when prependOperatingExpenses=true
    const srcChainTokenIn = estimation?.srcChainTokenIn as { approximateOperatingExpense?: string; [key: string]: unknown } | undefined;
    const operatingExpense = srcChainTokenIn?.approximateOperatingExpense != null
      ? String(srcChainTokenIn.approximateOperatingExpense)
      : undefined;

    const requiresSOL = params.originChainId === CHAIN_ID_SOLANA;

    return {
      provider: "debridge",
      expectedOut,
      expectedOutFormatted,
      fees: totalFees,
      feeCurrency: "USDC",
      feePayer: "user" as const,
      sponsorCost: "0",
      gasless: false,
      requiresSOL,
      solanaCostToUser: requiresSOL ? ESTIMATED_SOLANA_TX_LAMPORTS : undefined,
      operatingExpense,
      expiryAt,
      raw: data,
    };
  } finally {
    clearTimeout(timeout);
  }
}
