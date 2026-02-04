"use client";

import { useEffect, useState } from "react";
import type { NormalizedQuote } from "@/types/swap";

/**
 * Tracks time remaining until quote expiry and whether the quote has expired.
 */
export function useQuoteExpiryTimer(activeQuote: NormalizedQuote | null): {
  timeRemaining: number | null;
  isQuoteExpired: boolean;
} {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!activeQuote) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const remaining = activeQuote.expiryAt - Date.now();
      setTimeRemaining(remaining > 0 ? remaining : 0);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeQuote]);

  const isQuoteExpired = activeQuote != null && timeRemaining !== null && timeRemaining <= 0;

  return { timeRemaining, isQuoteExpired };
}
