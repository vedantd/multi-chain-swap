/**
 * Production-grade token lists: fetch supported tokens from Relay and deBridge APIs,
 * merge and cache so the UI shows all tokens either provider supports.
 */

import type { ChainToken } from "@/lib/chainConfig";
import { toRelayChainId, TOKENS_BY_CHAIN } from "@/lib/chainConfig";
import { SUPPORTED_TOKENS_STALE_TIME_MS } from "@/lib/constants";
import { normalizeTokenAddress } from "@/lib/utils/address";

const SUPPORTED_TOKENS_CACHE_MS = SUPPORTED_TOKENS_STALE_TIME_MS;
const CACHE_MS = 5 * 60 * 1000; // 5 minutes
const RELAY_CURRENCIES_URL = "https://api.relay.link/currencies/v2";
const DEBRIDGE_TOKEN_LIST_URL = "https://dln.debridge.finance/v1.0/token-list";

const cache = new Map<number, { tokens: ChainToken[]; at: number }>();

/** Fetch currencies for a chain from Relay (verified, default list, limit 100). */
async function fetchRelayCurrencies(chainId: number): Promise<ChainToken[]> {
  const relayChainId = toRelayChainId(chainId);
  const baseUrl = process.env.RELAY_API_URL ?? "https://api.relay.link";
  const url = `${baseUrl.replace(/\/$/, "")}/currencies/v2`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      defaultList: true,
      chainIds: [relayChainId],
      verified: true,
      limit: 100,
    }),
  });

  if (!res.ok) {
    console.warn("[supportedTokens] Relay currencies failed", chainId, res.status);
    return [];
  }

  const data = (await res.json()) as Array<{
    chainId?: number;
    address?: string;
    symbol?: string;
    name?: string;
    decimals?: number;
  }>;

  if (!Array.isArray(data)) return [];

  return data
    .filter((c) => c?.address != null && c?.symbol != null)
    .map((c) => ({
      address: normalizeTokenAddress(c.address!),
      symbol: String(c.symbol).trim() || "???",
      decimals: typeof c.decimals === "number" && c.decimals >= 0 ? c.decimals : 18,
    }));
}

/** Fetch token list for a chain from deBridge DLN. */
async function fetchDebridgeTokens(chainId: number): Promise<ChainToken[]> {
  const url = `${DEBRIDGE_TOKEN_LIST_URL}?chainId=${chainId}`;
  const res = await fetch(url);

  if (!res.ok) {
    console.warn("[supportedTokens] deBridge token-list failed", chainId, res.status);
    return [];
  }

  const data = (await res.json()) as { tokens?: Record<string, { symbol?: string; decimals?: number; address?: string }> };
  const tokens = data?.tokens;
  if (!tokens || typeof tokens !== "object") return [];

  return Object.values(tokens)
    .filter((t) => t?.address != null && t?.symbol != null)
    .map((t) => ({
      address: normalizeTokenAddress(t.address!),
      symbol: String(t.symbol).trim() || "???",
      decimals: typeof t.decimals === "number" && t.decimals >= 0 ? t.decimals : 18,
    }));
}

/** Merge two token lists by address (union); prefer first occurrence for symbol/decimals. */
function mergeTokenLists(a: ChainToken[], b: ChainToken[]): ChainToken[] {
  const byAddress = new Map<string, ChainToken>();
  for (const t of a) byAddress.set(t.address.toLowerCase(), t);
  for (const t of b) {
    const key = t.address.toLowerCase();
    if (!byAddress.has(key)) byAddress.set(key, t);
  }
  const merged = Array.from(byAddress.values());
  merged.sort((x, y) => x.symbol.localeCompare(y.symbol, undefined, { sensitivity: "base" }));
  return merged;
}

/** Canonical addresses for this chain (from TOKENS_BY_CHAIN); normalized for comparison. */
function getCanonicalAddressSet(chainId: number): Set<string> {
  const list = TOKENS_BY_CHAIN[chainId];
  if (!list?.length) return new Set();
  const set = new Set<string>();
  for (const t of list) {
    set.add(normalizeTokenAddress(t.address));
  }
  return set;
}

/**
 * One token per symbol: prefer canonical address (TOKENS_BY_CHAIN) when present in the list;
 * otherwise keep first occurrence (stable order).
 */
function dedupeBySymbol(chainId: number, tokens: ChainToken[]): ChainToken[] {
  const canonical = getCanonicalAddressSet(chainId);
  const bySymbol = new Map<string, ChainToken>();
  for (const t of tokens) {
    const key = t.symbol.toUpperCase();
    const existing = bySymbol.get(key);
    if (!existing) {
      bySymbol.set(key, t);
      continue;
    }
    if (canonical.has(normalizeTokenAddress(t.address))) bySymbol.set(key, t);
  }
  const out = Array.from(bySymbol.values());
  out.sort((x, y) => x.symbol.localeCompare(y.symbol, undefined, { sensitivity: "base" }));
  return out;
}

/**
 * Get all supported tokens for a chain from Relay and deBridge, with in-memory cache.
 * Returns union of both providers so the user can pick any token either supports.
 */
export async function getSupportedTokensForChain(chainId: number): Promise<ChainToken[]> {
  const cached = cache.get(chainId);
  if (cached && Date.now() - cached.at < SUPPORTED_TOKENS_CACHE_MS) return cached.tokens;

  const [relay, debridge] = await Promise.all([
    fetchRelayCurrencies(chainId),
    fetchDebridgeTokens(chainId),
  ]);

  const merged = mergeTokenLists(relay, debridge);
  const tokens = dedupeBySymbol(chainId, merged);
  cache.set(chainId, { tokens, at: Date.now() });
  return tokens;
}
