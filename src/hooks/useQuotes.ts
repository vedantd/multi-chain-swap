"use client";

import { useQuery } from "@tanstack/react-query";
import type { QuotesResult, SwapParams } from "@/types/swap";

async function fetchQuotes(params: SwapParams): Promise<QuotesResult> {
  const destinationAddress = params.recipientAddress ?? params.userAddress;
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
  });

  const res = await fetch("/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const json = await res.json();

  if (!res.ok) {
    console.error("[Quotes] Error response:", res.status, json);
    const message =
      json?.error?.message ?? `Request failed: ${res.status}`;
    throw new Error(message);
  }

  if (!json.success || !json.data) {
    console.error("[Quotes] Invalid success response:", json);
    throw new Error(json?.error?.message ?? "Invalid response");
  }

  const data = json.data as QuotesResult;
  console.log("[Quotes] Success – both quotes:", data.quotes);
  console.log("[Quotes] Best quote:", data.best);
  console.log("[Quotes] Destination address (recipient):", destinationAddress);
  return data;
}

export function useQuotes(params: SwapParams | null) {
  return useQuery({
    queryKey: ["quotes", params],
    queryFn: () => fetchQuotes(params!),
    enabled:
      !!params &&
      !!params.userAddress &&
      !!params.amount &&
      params.amount !== "0" &&
      !!params.originToken &&
      !!params.destinationToken,
    staleTime: 0,
    retry: 1,
    retryDelay: 2000,
  });
}
