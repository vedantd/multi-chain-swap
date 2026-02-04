/**
 * Execute a deBridge (DLN) quote. Origin is always Solana.
 * API returns a serialized Solana tx (base64); we deserialize and send via sendTransaction.
 */

import type { NormalizedQuote, SwapParams } from "@/types/swap";
import type { ExecutionContext } from "./types";
import { createSwapRecordFromQuote, updateSwapStatus } from "@/lib/swap/history";
import { getUserFriendlyErrorMessage, withRetry } from "@/lib/wallet/errors";
import { deserializeBase64ToVersionedTransaction } from "./solanaTransaction";
import { pollTransactionStatus, toSwapTransactionStatus } from "@/lib/solana/transactionStatus";

function getSolanaTxBase64(rawTx: unknown): string | null {
  if (typeof rawTx === "string" && rawTx.length > 0) return rawTx;
  if (rawTx && typeof rawTx === "object") {
    const o = rawTx as Record<string, unknown>;
    const t = o.transaction ?? o.data;
    if (typeof t === "string" && t.length > 0) return t;
  }
  return null;
}

export async function executeDebridgeQuote(
  quote: NormalizedQuote,
  params: SwapParams,
  ctx: ExecutionContext
): Promise<void> {
  const raw = quote.raw as Record<string, unknown>;
  const rawTx = raw?.tx;
  const debridgeOrderId = raw?.orderId != null ? String(raw.orderId) : undefined;

  if (rawTx == null) {
    ctx.setExecuteError("deBridge quote missing transaction data.");
    return;
  }

  const base64 = getSolanaTxBase64(rawTx);
  if (!base64) {
    ctx.setExecuteError("deBridge did not return a Solana transaction. Please try again.");
    return;
  }

  const { connection, sendTransaction } = ctx;
  if (!sendTransaction) {
    ctx.setExecuteError("Wallet does not support sending transactions.");
    return;
  }

  const tx = deserializeBase64ToVersionedTransaction(base64);
  ctx.setTransactionStatus("pending");

  let sig: string;
  try {
    sig = await withRetry(async () => {
      return await sendTransaction(tx, connection, { skipPreflight: false });
    });
  } catch (err) {
    ctx.setTransactionStatus("failed");
    ctx.setExecuteError(getUserFriendlyErrorMessage(err, { transactionType: "swap", provider: "debridge" }));
    return;
  }

  ctx.setTransactionSignature(sig);
  let swapRecordId: string | null = null;
  try {
    const swapRecord = createSwapRecordFromQuote(quote, params, sig, null, debridgeOrderId);
    swapRecordId = swapRecord.id;
    updateSwapStatus({ id: swapRecord.id, status: "pending", transactionHash: sig });
  } catch (historyErr) {
    console.error("[Swap History] Failed to create swap record:", historyErr);
  }

  const statusResult = await pollTransactionStatus(connection, sig);
  ctx.setTransactionStatus(statusResult.status);

  if (swapRecordId) {
    try {
      updateSwapStatus({
        id: swapRecordId,
        status: toSwapTransactionStatus(statusResult.status),
        transactionHash: sig,
        errorMessage: statusResult.error ? String(statusResult.error) : null,
      });
    } catch (historyErr) {
      console.error("[Swap History] Failed to update swap status:", historyErr);
    }
  }

  if (statusResult.status === "failed") {
    ctx.setExecuteError(
      getUserFriendlyErrorMessage(statusResult.error ?? new Error("Transaction failed"), {
        transactionType: "swap",
        provider: "debridge",
      })
    );
    return;
  }

  ctx.setTransactionStatus(null);
  ctx.setTransactionSignature(null);
  ctx.setExecuteSuccess(`Transaction confirmed. Signature: ${sig.slice(0, 8)}...`);
}
