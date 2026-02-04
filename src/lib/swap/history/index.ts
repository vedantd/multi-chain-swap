/**
 * Swap History Service (Mock/In-Memory)
 *
 * In-memory storage for swap transaction history.
 * Uses Map-based storage that can be easily replaced with Prisma later.
 */

import type {
  SwapTransaction,
  CreateSwapRecordInput,
  UpdateSwapStatusInput,
  SwapHistoryQuery,
  SwapHistoryResponse,
  NormalizedQuote,
  SwapParams,
} from "@/types/swap";
import { TOKENS_BY_CHAIN } from "@/lib/chainConfig";

/** Generate a UUID v4. Works in browser and Node (avoids crypto-browserify missing randomUUID). */
function generateId(): string {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto &&
    typeof (crypto as { randomUUID?: () => string }).randomUUID === "function"
  ) {
    return (crypto as { randomUUID: () => string }).randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    throw new Error("Secure random not available");
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Helper to get token symbol from address and chain ID
 */
function getTokenSymbol(tokenAddress: string, chainId: number): string {
  const tokens = TOKENS_BY_CHAIN[chainId];
  if (!tokens) return "UNKNOWN";
  const token = tokens.find((t) => t.address.toLowerCase() === tokenAddress.toLowerCase());
  return token?.symbol ?? "UNKNOWN";
}

/**
 * Create swap record from quote and transaction details
 */
export function createSwapRecordFromQuote(
  quote: NormalizedQuote,
  params: SwapParams,
  transactionHash: string,
  requestId?: string | null,
  orderId?: string | null
): SwapTransaction {
  const originTokenSymbol = getTokenSymbol(params.originToken, params.originChainId);
  const destinationTokenSymbol = getTokenSymbol(
    params.destinationToken,
    params.destinationChainId
  );

  const originToken = TOKENS_BY_CHAIN[params.originChainId]?.find(
    (t) => t.address.toLowerCase() === params.originToken.toLowerCase()
  );
  const originDecimals = originToken?.decimals ?? 6;
  const originAmountNum = BigInt(params.amount);
  const originDivisor = BigInt(10 ** originDecimals);
  const originWhole = originAmountNum / originDivisor;
  const originRemainder = originAmountNum % originDivisor;
  const originFormatted =
    originRemainder === BigInt(0)
      ? originWhole.toString()
      : `${originWhole}.${originRemainder.toString().padStart(originDecimals, "0").replace(/0+$/, "")}`;

  return createSwapRecord({
    userAddress: params.userAddress,
    provider: quote.provider,
    originChainId: params.originChainId,
    originToken: params.originToken,
    originTokenSymbol,
    originTokenAmount: params.amount,
    originTokenAmountFormatted: originFormatted,
    destinationChainId: params.destinationChainId,
    destinationToken: params.destinationToken,
    destinationTokenSymbol,
    destinationTokenAmount: quote.expectedOut,
    destinationTokenAmountFormatted: quote.expectedOutFormatted,
    recipientAddress: params.recipientAddress ?? params.userAddress,
    transactionHash,
    requestId: requestId ?? null,
    orderId: orderId ?? null,
    fees: quote.fees,
    feeCurrency: quote.feeCurrency,
    feePayer: quote.feePayer,
    sponsorCost: quote.sponsorCost,
    userFee: quote.userFee ?? null,
    userFeeCurrency: quote.userFeeCurrency ?? null,
    userFeeUsd: quote.userFeeUsd ?? null,
    metadata: {
      quoteExpiryAt: quote.expiryAt,
      timeEstimateSeconds: quote.timeEstimateSeconds,
      slippageTolerance: quote.slippageTolerance,
    },
  });
}

const swapStore = new Map<string, SwapTransaction>();
const userIndex = new Map<string, string[]>();
const txHashIndex = new Map<string, string>();
const requestIdIndex = new Map<string, string>();
const orderIdIndex = new Map<string, string>();

export function createSwapRecord(input: CreateSwapRecordInput): SwapTransaction {
  const now = new Date();
  const swap: SwapTransaction = {
    id: generateId(),
    userAddress: input.userAddress,
    provider: input.provider,
    status: "pending",
    originChainId: input.originChainId,
    originToken: input.originToken,
    originTokenSymbol: input.originTokenSymbol,
    originTokenAmount: input.originTokenAmount,
    originTokenAmountFormatted: input.originTokenAmountFormatted,
    destinationChainId: input.destinationChainId,
    destinationToken: input.destinationToken,
    destinationTokenSymbol: input.destinationTokenSymbol,
    destinationTokenAmount: input.destinationTokenAmount,
    destinationTokenAmountFormatted: input.destinationTokenAmountFormatted,
    recipientAddress: input.recipientAddress,
    transactionHash: input.transactionHash ?? null,
    destinationTransactionHash: null,
    requestId: input.requestId ?? null,
    orderId: input.orderId ?? null,
    fees: input.fees,
    feeCurrency: input.feeCurrency,
    feePayer: input.feePayer,
    sponsorCost: input.sponsorCost,
    userFee: input.userFee ?? null,
    userFeeCurrency: input.userFeeCurrency ?? null,
    userFeeUsd: input.userFeeUsd ?? null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    errorMessage: null,
    metadata: input.metadata ?? null,
  };

  swapStore.set(swap.id, swap);
  if (!userIndex.has(swap.userAddress)) userIndex.set(swap.userAddress, []);
  userIndex.get(swap.userAddress)!.push(swap.id);
  if (swap.transactionHash) txHashIndex.set(swap.transactionHash, swap.id);
  if (swap.requestId) requestIdIndex.set(swap.requestId, swap.id);
  if (swap.orderId) orderIdIndex.set(swap.orderId, swap.id);

  return swap;
}

export function updateSwapStatus(input: UpdateSwapStatusInput): SwapTransaction | null {
  const swap = swapStore.get(input.id);
  if (!swap) return null;

  const updated: SwapTransaction = {
    ...swap,
    status: input.status,
    updatedAt: new Date(),
    transactionHash: input.transactionHash ?? swap.transactionHash,
    destinationTransactionHash: input.destinationTransactionHash ?? swap.destinationTransactionHash,
    errorMessage: input.errorMessage ?? swap.errorMessage,
    completedAt: input.completedAt ?? swap.completedAt,
  };
  swapStore.set(swap.id, updated);
  if (input.transactionHash && input.transactionHash !== swap.transactionHash) {
    if (swap.transactionHash) txHashIndex.delete(swap.transactionHash);
    txHashIndex.set(input.transactionHash, swap.id);
  }
  return updated;
}

export function getSwapById(id: string): SwapTransaction | null {
  return swapStore.get(id) ?? null;
}

export function getSwapByTransactionHash(transactionHash: string): SwapTransaction | null {
  const id = txHashIndex.get(transactionHash);
  return id ? swapStore.get(id) ?? null : null;
}

export function getSwapByRequestId(requestId: string): SwapTransaction | null {
  const id = requestIdIndex.get(requestId);
  return id ? swapStore.get(id) ?? null : null;
}

export function getSwapByOrderId(orderId: string): SwapTransaction | null {
  const id = orderIdIndex.get(orderId);
  return id ? swapStore.get(id) ?? null : null;
}

export function getSwapHistory(query: SwapHistoryQuery): SwapHistoryResponse {
  const swapIds = userIndex.get(query.userAddress) ?? [];
  let swaps = swapIds
    .map((id) => swapStore.get(id))
    .filter((swap): swap is SwapTransaction => swap !== undefined);
  if (query.status) swaps = swaps.filter((s) => s.status === query.status);
  if (query.provider) swaps = swaps.filter((s) => s.provider === query.provider);
  swaps.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const total = swaps.length;
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  return { swaps: swaps.slice(offset, offset + limit), total, limit, offset };
}

export function getAllSwaps(): SwapTransaction[] {
  return Array.from(swapStore.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

export function clearAllSwaps(): void {
  swapStore.clear();
  userIndex.clear();
  txHashIndex.clear();
  requestIdIndex.clear();
  orderIdIndex.clear();
}
