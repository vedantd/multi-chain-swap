import type { NormalizedQuote, SwapParams } from "@/types/swap";
import { CHAIN_ID_SOLANA, ESTIMATED_SOLANA_TX_LAMPORTS, isEvmChain, toDebridgeChainId } from "@/lib/chainConfig";

const QUOTE_VALIDITY_MS = 30_000;

const DEBRIDGE_API_BASE = "https://api.dln.trade";

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
  searchParams.set(
    "srcChainOrderAuthorityAddress",
    params.userAddress
  );
  searchParams.set(
    "dstChainOrderAuthorityAddress",
    dstAddress
  );

  const url = `${path}?${searchParams.toString()}`;
  console.log("[deBridge] GET url (copy for curl):", url);
  console.log("[deBridge] Params: srcChainId, dstChainId, senderAddress, dstChainTokenOutRecipient:", params.originChainId, params.destinationChainId, params.userAddress, params.recipientAddress ?? params.userAddress);

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
    console.log("[deBridge] Success, orderId:", data.orderId ?? "n/a", "estimation:", !!data.estimation);
    const expiryAt = Date.now() + QUOTE_VALIDITY_MS;

    const estimation = data.estimation as {
      dstChainTokenOut?: { amount?: string; approximateUsdValue?: number };
      takeAmount?: string;
      takeAmountFormatted?: string;
      [key: string]: unknown;
    } | undefined;
    const order = data.order;
    
    // Expected output is in estimation.dstChainTokenOut.amount (not takeAmount)
    const dstTokenOut = estimation?.dstChainTokenOut;
    const expectedOut =
      dstTokenOut?.amount != null
        ? String(dstTokenOut.amount)
        : estimation?.takeAmount != null
          ? String(estimation.takeAmount)
          : order?.takeOffer?.amount != null
            ? String(order.takeOffer.amount)
            : "0";
    
    // Use approximateUsdValue for formatted display
    const rawFormatted =
      dstTokenOut?.approximateUsdValue != null
        ? String(dstTokenOut.approximateUsdValue)
        : estimation?.takeAmountFormatted != null
          ? String(estimation.takeAmountFormatted)
          : expectedOut;
    const expectedOutFormatted = rawFormatted;

    const fixFee = data.fixFee != null ? String(data.fixFee) : "0";
    const protocolFee = data.protocolFee != null ? String(data.protocolFee) : "0";
    const totalFees = bigIntAdd(fixFee, protocolFee);

    return {
      provider: "debridge",
      expectedOut,
      expectedOutFormatted,
      fees: totalFees,
      feeCurrency: "USDC",
      feePayer: "user" as const,
      sponsorCost: "0",
      solanaCostToUser:
        params.originChainId === CHAIN_ID_SOLANA ? ESTIMATED_SOLANA_TX_LAMPORTS : undefined,
      expiryAt,
      raw: data,
    };
  } finally {
    clearTimeout(timeout);
  }
}
