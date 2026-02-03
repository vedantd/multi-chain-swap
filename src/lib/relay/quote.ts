import type { NormalizedQuote, SwapParams } from "@/types/swap";
import { toRelayChainId } from "@/lib/chainConfig";

const QUOTE_VALIDITY_MS = 30_000;

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
  let total = 0n;
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

export async function getRelayQuote(params: SwapParams): Promise<NormalizedQuote> {
  const baseUrl = process.env.RELAY_API_URL ?? "https://api.relay.link";
  const url = `${baseUrl.replace(/\/$/, "")}/quote/v2`;

  const tradeType =
    params.tradeType === "exact_in" ? "EXACT_INPUT" : "EXACT_OUTPUT";

  const recipient = params.recipientAddress ?? params.userAddress;
  const body = {
    user: params.userAddress,
    recipient,
    originChainId: toRelayChainId(params.originChainId),
    destinationChainId: toRelayChainId(params.destinationChainId),
    originCurrency: params.originToken,
    destinationCurrency: params.destinationToken,
    amount: params.amount,
    tradeType,
  };

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
        const json = JSON.parse(text) as { message?: string; error?: string };
        message = json.message ?? json.error ?? message;
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

    return {
      provider: "relay",
      expectedOut,
      expectedOutFormatted,
      fees: totalFeeAmount,
      feeCurrency,
      expiryAt,
      raw: data,
      timeEstimateSeconds,
    };
  } finally {
    clearTimeout(timeout);
  }
}
