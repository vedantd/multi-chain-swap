/**
 * Quote display helpers for UI (receive amount, formatted values, fee display).
 * Uses effectiveReceiveRaw from quoteService and formatRawAmount from chainConfig.
 */

import type { NormalizedQuote } from "@/types/swap";
import { formatRawAmount } from "@/lib/chainConfig";
import { formatAmountWithUsd } from "@/lib/utils/formatting";
import { effectiveReceiveRaw } from "@/lib/swap/quoteService";

export interface QuotePrices {
  sol: number | null;
  [key: string]: number | null | undefined;
}

export interface ReceiveDisplay {
  effectiveReceive: bigint;
  effectiveReceiveFormatted: string;
  estimatedOutFormatted: string;
  symbol: string;
}

/**
 * Compute display values for "you receive" and fee breakdown from a normalized quote.
 */
export function computeReceiveDisplay(q: NormalizedQuote): ReceiveDisplay {
  const effectiveReceive = effectiveReceiveRaw(q);
  const expectedOutNum = BigInt(q.expectedOut);
  const expectedOutFormattedNum = parseFloat(q.expectedOutFormatted);
  const useRatio =
    expectedOutNum > BigInt(0) &&
    Number.isFinite(expectedOutFormattedNum) &&
    expectedOutFormattedNum >= 0;

  const effectiveReceiveFormatted = useRatio
    ? (() => {
        const ratio = Number(effectiveReceive) / Number(expectedOutNum);
        const value = ratio * expectedOutFormattedNum;
        if (!Number.isFinite(value) || value < 0) return "0";
        if (value >= 1e9) {
          return String(Math.round(value));
        }
        const formatted = value.toFixed(3);
        return formatted.replace(/\.?0+$/, "");
      })()
    : formatRawAmount(String(effectiveReceive), q.feeCurrency);

  return {
    effectiveReceive,
    effectiveReceiveFormatted,
    estimatedOutFormatted: q.expectedOutFormatted,
    symbol: q.feeCurrency,
  };
}

/**
 * Compute network fee display string for a quote (SOL transaction costs).
 */
export function getNetworkFeeDisplay(q: NormalizedQuote, prices: QuotePrices): string {
  const solPrice = prices.sol ?? null;
  const isGasless = !!q.gasless;
  if (isGasless) return "Sponsored";
  if (q.provider === "jupiter") {
    if (q.solanaCostToUser && q.solanaCostToUser !== "0" && q.solanaCostToUser !== undefined) {
      const solCost = BigInt(q.solanaCostToUser);
      if (solCost > BigInt(0)) {
        return `-~${formatAmountWithUsd(q.solanaCostToUser, "SOL", solPrice)}`;
      }
      return "Sponsored";
    }
    return "~0.0003 SOL";
  }
  if (q.solanaCostToUser && q.solanaCostToUser !== "0" && q.solanaCostToUser !== undefined) {
    return `-~${formatAmountWithUsd(q.solanaCostToUser, "SOL", solPrice)}`;
  }
  return "—";
}

export interface ServiceFeeDisplayResult {
  text: string;
  isFree: boolean;
}

/**
 * Compute service fee display for a quote (platform/swap fee).
 */
export function getServiceFeeDisplay(q: NormalizedQuote, prices: QuotePrices): ServiceFeeDisplayResult {
  const serviceFeeCurrency = q.userFeeCurrency ?? q.feeCurrency ?? "USDC";
  let serviceFeeAmount = "0";
  if (q.userFee != null && q.userFee !== "0") {
    serviceFeeAmount = q.userFee;
  } else if (q.fees != null && q.fees !== "0") {
    serviceFeeAmount = q.fees;
  }
  const serviceFeePrice =
    serviceFeeCurrency === "SOL" ? (prices.sol ?? null) : (prices[serviceFeeCurrency] ?? null);
  const text =
    serviceFeeAmount !== "0"
      ? `-${formatAmountWithUsd(serviceFeeAmount, serviceFeeCurrency, serviceFeePrice)}`
      : "Free";
  return { text, isFree: serviceFeeAmount === "0" };
}
