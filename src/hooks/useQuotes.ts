"use client";

// External dependencies
import { useQuery } from "@tanstack/react-query";

// Internal types
import type { GetBalancesForQuote, QuoteBalanceInput, QuotesResult, SwapParams } from "@/types/swap";

async function fetchQuotes(
  params: SwapParams,
  balances?: QuoteBalanceInput
): Promise<QuotesResult> {
  const destinationAddress = params.recipientAddress ?? params.userAddress;
  const body: SwapParams & QuoteBalanceInput = { ...params };
  if (balances?.userSOLBalance !== undefined && balances.userSOLBalance !== "") {
    body.userSOLBalance = balances.userSOLBalance;
  }
  if (balances?.userSolanaUSDCBalance !== undefined && balances.userSolanaUSDCBalance !== "") {
    body.userSolanaUSDCBalance = balances.userSolanaUSDCBalance;
  }
  console.log("[Quotes] Request params:", {
    originChainId: params.originChainId,
    destinationChainId: params.destinationChainId,
    originToken: params.originToken,
    destinationToken: params.destinationToken,
    amount: params.amount,
    userAddress: params.userAddress,
    recipientAddress: params.recipientAddress,
    destinationAddressUsed: destinationAddress,
    tradeType: params.tradeType,
    userSOLBalanceProvided: balances?.userSOLBalance != null,
    userSolanaUSDCBalanceProvided: balances?.userSolanaUSDCBalance != null,
  });

  const res = await fetch("/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok) {
    console.error("[Quotes] Error response:", res.status, json);
    const message =
      json?.error?.message ?? `Request failed: ${res.status}`;
    const err = new Error(message) as Error & { code?: string };
    if (typeof json?.error?.code === "string") {
      err.code = json.error.code;
    }
    throw err;
  }

  if (!json.success || !json.data) {
    console.error("[Quotes] Invalid success response:", json);
    const message = json?.error?.message ?? "Invalid response";
    const err = new Error(message) as Error & { code?: string };
    if (typeof json?.error?.code === "string") {
      err.code = json.error.code;
    }
    throw err;
  }

  const data = json.data as QuotesResult;
  console.log("[Quotes] Success – both quotes:", data.quotes);
  console.log("[Quotes] Best quote:", data.best);
  console.log("[Quotes] Destination address (recipient):", destinationAddress);
  return data;
}


/**
 * React hook to fetch and manage swap quotes.
 * 
 * Automatically fetches quotes when swap parameters are complete and valid.
 * Supports optional balance fetching to optimize quote selection (e.g., gasless when user has USDC).
 * 
 * @param params - Swap parameters, or null to disable fetching
 * @param balancesOrGetter - Optional balance data or function to fetch balances dynamically
 * @returns React Query result with quotes data, loading state, and error handling
 * 
 * @example
 * ```tsx
 * const { data, isLoading } = useQuotes(swapParams, async () => {
 *   const sol = await getSolBalance(connection, address);
 *   const usdc = await getTokenBalance(connection, address, USDC_MINT);
 *   return { userSOLBalance: sol, userSolanaUSDCBalance: usdc };
 * });
 * ```
 */
export function useQuotes(
  params: SwapParams | null,
  balancesOrGetter?: QuoteBalanceInput | GetBalancesForQuote,
  options?: {
    /** Disable automatic refetching (e.g., after timeout). User must manually refetch. */
    disableAutoRefetch?: boolean;
  }
) {
  return useQuery({
    queryKey: ["quotes", params, typeof balancesOrGetter === "function" ? "fresh" : balancesOrGetter],
    queryFn: async () => {
      const balances =
        typeof balancesOrGetter === "function"
          ? await balancesOrGetter()
          : balancesOrGetter;
      return fetchQuotes(params!, balances);
    },
    enabled:
      !!params &&
      !!params.userAddress &&
      !!params.amount &&
      params.amount !== "0" &&
      !!params.originToken &&
      params.destinationChainId != null &&
      !!params.destinationToken &&
      !options?.disableAutoRefetch,
    staleTime: 0,
    retry: 1,
    retryDelay: 2000,
    refetchOnWindowFocus: !options?.disableAutoRefetch,
    refetchOnReconnect: !options?.disableAutoRefetch,
    refetchOnMount: !options?.disableAutoRefetch,
  });
}
