"use client";

import { useQuery } from "@tanstack/react-query";
import type { ChainToken } from "@/lib/chainConfig";
import { getSupportedTokensForChain } from "@/lib/tokens/supportedTokens";
import { SUPPORTED_TOKENS_STALE_TIME_MS } from "@/lib/constants";

/**
 * React hook to fetch supported tokens for a chain from Relay and deBridge.
 * 
 * Fetches and merges token lists from both providers, caching results for 5 minutes.
 * Enable only when needed to avoid unnecessary API calls until user progresses in the form.
 * 
 * @param chainId - Chain ID to fetch tokens for, or null to disable fetching
 * @param options - Optional configuration
 * @param options.enabled - Whether to enable the query (defaults to true when chainId is provided)
 * @returns Object with tokens array, loading states, error, and refetch function
 * 
 * @example
 * ```tsx
 * const { tokens, isLoading } = useSupportedTokens(8453); // Base chain
 * ```
 */
export function useSupportedTokens(
  chainId: number | null,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled !== false && chainId != null;
  const query = useQuery({
    queryKey: ["supportedTokens", chainId],
    queryFn: () => getSupportedTokensForChain(chainId!),
    enabled,
    staleTime: SUPPORTED_TOKENS_STALE_TIME_MS,
  });

  return {
    tokens: (query.data ?? []) as ChainToken[],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
