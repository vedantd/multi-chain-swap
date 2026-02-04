/**
 * Route validation using Relay's Chains API.
 * 
 * Checks if a token pair route is supported before attempting to fetch quotes.
 * This prevents wasting user time on routes that won't work.
 * 
 * Based on Relay documentation:
 * - If tokenSupport is "All", route is supported for tokens with Solver/DEX liquidity
 * - If tokenSupport is "Limited", check erc20Currencies and currency fields for supportsBridging: true
 */

import { toRelayChainId } from "@/lib/chainConfig";
import { normalizeTokenAddress } from "@/lib/utils/address";

const RELAY_CHAINS_URL = "https://api.relay.link/chains";
const CACHE_MS = 5 * 60 * 1000; // 5 minutes cache

interface RelayChain {
  id: number;
  name: string;
  displayName: string;
  tokenSupport: "All" | "Limited";
  vmType?: "evm" | "svm";
  currency?: {
    id: string;
    symbol: string;
    address: string;
    supportsBridging: boolean;
  };
  erc20Currencies?: Array<{
    id?: string;
    symbol: string;
    address: string;
    supportsBridging?: boolean;
  }>;
  featuredTokens?: Array<{
    id?: string;
    symbol: string;
    address: string;
    supportsBridging?: boolean;
  }>;
}

interface ChainsCache {
  chains: RelayChain[];
  fetchedAt: number;
}

let chainsCache: ChainsCache | null = null;

/**
 * Fetch chains data from Relay API with caching.
 */
async function fetchChains(): Promise<RelayChain[]> {
  // Return cached data if still valid
  if (chainsCache && Date.now() - chainsCache.fetchedAt < CACHE_MS) {
    return chainsCache.chains;
  }

  const baseUrl = process.env.RELAY_API_URL ?? "https://api.relay.link";
  const url = `${baseUrl.replace(/\/$/, "")}/chains`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      console.warn("[routeValidation] Failed to fetch chains:", res.status);
      // Return cached data if available, even if stale
      if (chainsCache) {
        return chainsCache.chains;
      }
      throw new Error(`Failed to fetch chains: ${res.status}`);
    }

    const data = (await res.json()) as { chains?: RelayChain[] };
    const chains = Array.isArray(data.chains) ? data.chains : [];

    // Update cache
    chainsCache = {
      chains,
      fetchedAt: Date.now(),
    };

    return chains;
  } catch (error) {
    console.error("[routeValidation] Error fetching chains:", error);
    // Return cached data if available, even if stale
    if (chainsCache) {
      return chainsCache.chains;
    }
    throw error;
  }
}

/**
 * Compare two addresses, handling both EVM and Solana formats.
 */
function addressesMatch(addr1: string, addr2: string): boolean {
  return normalizeTokenAddress(addr1) === normalizeTokenAddress(addr2);
}

/**
 * Check if a token supports bridging on a chain.
 * Uses normalizeTokenAddress for consistent comparison (EVM lowercased, Solana as-is).
 */
function isTokenSupportedForBridging(
  chain: RelayChain,
  tokenAddress: string
): boolean {
  // Check if tokenSupport is "All" - then route is supported if Solver/DEX liquidity exists
  if (chain.tokenSupport === "All") {
    return true;
  }

  // Check native currency
  if (chain.currency?.address != null) {
    if (
      addressesMatch(chain.currency.address, tokenAddress) &&
      chain.currency.supportsBridging === true
    ) {
      return true;
    }
  }

  // Check ERC20 currencies
  if (chain.erc20Currencies && Array.isArray(chain.erc20Currencies)) {
    for (const token of chain.erc20Currencies) {
      if (token.address != null && addressesMatch(token.address, tokenAddress)) {
        if (token.supportsBridging !== false) return true;
      }
    }
  }

  // Check featuredTokens (e.g. Solana/SVM chains may list tokens here)
  if (chain.featuredTokens && Array.isArray(chain.featuredTokens)) {
    for (const token of chain.featuredTokens) {
      if (token.address != null && addressesMatch(token.address, tokenAddress)) {
        if (token.supportsBridging !== false) return true;
      }
    }
  }

  return false;
}

/**
 * Check if a route is supported by Relay.
 * 
 * @param originChainId - Internal chain ID (will be converted to Relay chain ID)
 * @param originToken - Token address on origin chain
 * @param destinationChainId - Internal chain ID (will be converted to Relay chain ID)
 * @param destinationToken - Token address on destination chain
 * @returns Object with isSupported flag and optional error message
 */
export async function validateRelayRoute(
  originChainId: number,
  originToken: string,
  destinationChainId: number,
  destinationToken: string
): Promise<{ isSupported: boolean; reason?: string }> {
  try {
    const chains = await fetchChains();
    // If chains list is empty (e.g. API returned no data), allow route through so quote API can be tried
    if (!chains || chains.length === 0) {
      console.warn("[routeValidation] Chains list empty, allowing route through");
      return { isSupported: true };
    }

    const relayOriginChainId = toRelayChainId(originChainId);
    const relayDestinationChainId = toRelayChainId(destinationChainId);

    // Find origin and destination chains
    const originChain = chains.find((c) => c.id === relayOriginChainId);
    const destinationChain = chains.find((c) => c.id === relayDestinationChainId);

    if (!originChain) {
      return {
        isSupported: false,
        reason: `Origin chain ${originChainId} not found in Relay's supported chains`,
      };
    }

    if (!destinationChain) {
      return {
        isSupported: false,
        reason: `Destination chain ${destinationChainId} not found in Relay's supported chains`,
      };
    }

    // Check if origin token is supported
    const originTokenSupported = isTokenSupportedForBridging(
      originChain,
      originToken
    );
    if (!originTokenSupported) {
      return {
        isSupported: false,
        reason: `Origin token ${originToken} is not supported for bridging on ${originChain.displayName}`,
      };
    }

    // Check if destination token is supported
    const destinationTokenSupported = isTokenSupportedForBridging(
      destinationChain,
      destinationToken
    );
    if (!destinationTokenSupported) {
      return {
        isSupported: false,
        reason: `Destination token ${destinationToken} is not supported for bridging on ${destinationChain.displayName}`,
      };
    }

    // Both tokens are supported - route is valid
    // Note: Even if both tokens are supported, actual liquidity may not exist
    // This check prevents wasting time on routes that definitely won't work
    return { isSupported: true };
  } catch (error) {
    // If validation fails (e.g., API error), allow the route through
    // The quote API will handle the actual validation
    console.warn("[routeValidation] Route validation error, allowing route:", error);
    return { isSupported: true };
  }
}

/**
 * Pre-fetch chains data to warm the cache.
 * Call this early in the app lifecycle to improve UX.
 */
export async function prefetchChains(): Promise<void> {
  try {
    await fetchChains();
  } catch (error) {
    console.warn("[routeValidation] Failed to prefetch chains:", error);
  }
}
