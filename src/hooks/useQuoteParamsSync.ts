"use client";

import { useEffect } from "react";
import type { NormalizedQuote, SwapParams } from "@/types/swap";
import { QUOTE_DEBOUNCE_MS } from "@/lib/constants";

export interface UseQuoteParamsSyncParams {
  swapParams: SwapParams | null;
  setParams: (params: SwapParams | null) => void;
  setSelectedQuote: (quote: NormalizedQuote | null) => void;
  setParamsLastChangedAt: (timestamp: number | null) => void;
}

/**
 * Debounces swap params and syncs to store (setParams, clear selectedQuote).
 */
export function useQuoteParamsSync({
  swapParams,
  setParams,
  setSelectedQuote,
  setParamsLastChangedAt,
}: UseQuoteParamsSyncParams): void {
  useEffect(() => {
    if (!swapParams) {
      setParamsLastChangedAt(null);
      return;
    }
    setParamsLastChangedAt(Date.now());
    const t = setTimeout(() => {
      setParams(swapParams);
      setSelectedQuote(null);
    }, QUOTE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [swapParams, setParams, setSelectedQuote, setParamsLastChangedAt]);
}
