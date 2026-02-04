"use client";

import { useEffect } from "react";
import type { NormalizedQuote } from "@/types/swap";
import { TOKENS_BY_CHAIN } from "@/lib/chainConfig";
import { getSolPriceInUsdc, getTokenPriceUsd } from "@/lib/pricing";

export interface UseQuotePricesParams {
  best: NormalizedQuote | null;
  originChainId: number;
  destinationChainId: number;
  destinationToken: string;
  setPrices: (prices: { sol: number | null; [currency: string]: number | null }) => void;
}

/**
 * Fetches SOL and fee/destination token prices when best quote changes.
 */
export function useQuotePrices({
  best,
  originChainId,
  destinationChainId,
  destinationToken,
  setPrices,
}: UseQuotePricesParams): void {
  useEffect(() => {
    if (!best) {
      setPrices({ sol: null });
      return;
    }

    const fetchPrices = async () => {
      const newPrices: { sol: number | null; [currency: string]: number | null } = { sol: null };

      try {
        newPrices.sol = await getSolPriceInUsdc();
      } catch (error) {
        console.warn("[useQuotePrices] Failed to fetch SOL price:", error);
      }

      const feeCurrency = best.userFeeCurrency ?? best.feeCurrency;
      if (feeCurrency && feeCurrency !== "SOL") {
        if (feeCurrency === "USDC" || feeCurrency === "USDT") {
          newPrices[feeCurrency] = 1.0;
        } else {
          try {
            const originTokens = TOKENS_BY_CHAIN[originChainId] ?? [];
            const destTokens = TOKENS_BY_CHAIN[destinationChainId] ?? [];
            const token =
              originTokens.find((t) => t.symbol === feeCurrency) ??
              destTokens.find((t) => t.symbol === feeCurrency);
            if (token) {
              const chainId = destTokens.find((t) => t.symbol === feeCurrency)
                ? destinationChainId
                : originChainId;
              newPrices[feeCurrency] = await getTokenPriceUsd(token.address, chainId);
            }
          } catch (error) {
            console.warn(`[useQuotePrices] Failed to fetch ${feeCurrency} price:`, error);
          }
        }
      }

      if (destinationToken && destinationChainId) {
        const destTokenSymbol = best.feeCurrency;
        if (destTokenSymbol && destTokenSymbol !== "SOL") {
          if (destTokenSymbol === "USDC" || destTokenSymbol === "USDT") {
            newPrices[destTokenSymbol] = 1.0;
          } else if (!newPrices[destTokenSymbol]) {
            try {
              const destTokens = TOKENS_BY_CHAIN[destinationChainId] ?? [];
              const token = destTokens.find((t) => t.symbol === destTokenSymbol);
              if (token) {
                newPrices[destTokenSymbol] = await getTokenPriceUsd(token.address, destinationChainId);
              }
            } catch (error) {
              console.warn(`[useQuotePrices] Failed to fetch ${destTokenSymbol} price:`, error);
            }
          }
        }
      }

      setPrices(newPrices);
    };

    fetchPrices();
  }, [best, originChainId, destinationChainId, destinationToken, setPrices]);
}
