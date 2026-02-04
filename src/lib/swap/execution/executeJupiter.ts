/**
 * Execute a Jupiter quote: sign transaction, POST to /api/jupiter/execute, poll Solana status.
 */

import type { NormalizedQuote, SwapParams } from "@/types/swap";
import type { ExecutionContext } from "./types";
import { deserializeBase64ToVersionedTransaction } from "./solanaTransaction";
import { createSwapRecordFromQuote, updateSwapStatus } from "@/lib/swap/history";
import { pollTransactionStatus, toSwapTransactionStatus } from "@/lib/solana/transactionStatus";
import { getUserFriendlyErrorMessage } from "@/lib/wallet/errors";
import { getExplorerUrlForSignature } from "@/lib/utils/explorerUrl";

export async function executeJupiterQuote(
  quote: NormalizedQuote,
  params: SwapParams,
  ctx: ExecutionContext
): Promise<void> {
  const { connection, signTransaction } = ctx;
  if (!signTransaction) {
    ctx.setExecuteError("Wallet does not support signing. Try a different wallet.");
    return;
  }

  const raw = quote.raw as Record<string, unknown>;
  const base64Unsigned = raw?.transaction as string | undefined;
  const requestId = raw?.requestId != null ? String(raw.requestId) : undefined;

  if (!base64Unsigned || !requestId) {
    ctx.setExecuteError("Invalid Jupiter quote payload.");
    return;
  }

  const tx = deserializeBase64ToVersionedTransaction(base64Unsigned);
  ctx.setTransactionStatus("pending");
  const signedTx = await signTransaction(tx);
  const signedBuf = signedTx.serialize();
  const base64Signed = btoa(String.fromCharCode(...signedBuf));

  const executeRes = await fetch("/api/jupiter/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedTransaction: base64Signed, requestId }),
  });
  const executeData = (await executeRes.json()) as { status?: string; signature?: string; error?: string };

  if (!executeRes.ok) {
    ctx.setTransactionStatus("failed");
    ctx.setExecuteError(
      getUserFriendlyErrorMessage(new Error(executeData.error ?? "Jupiter execute failed"), {
        transactionType: "swap",
        provider: "jupiter",
      })
    );
    return;
  }

  if (executeData.status !== "Success" || !executeData.signature) {
    ctx.setTransactionStatus("failed");
    ctx.setExecuteError(executeData.error ?? "Swap failed");
    return;
  }

  const sig = executeData.signature;
  ctx.setTransactionSignature(sig);
  ctx.setTransactionStatus("pending");

  let swapRecordId: string | null = null;
  try {
    const swapRecord = createSwapRecordFromQuote(quote, params, sig, null, null);
    swapRecordId = swapRecord.id;
  } catch (historyErr) {
    console.error("[Swap History] Failed to create swap record:", historyErr);
  }

  const statusResult = await pollTransactionStatus(connection, sig);

  if (swapRecordId) {
    try {
      updateSwapStatus({
        id: swapRecordId,
        status: toSwapTransactionStatus(statusResult.status),
        transactionHash: sig,
        errorMessage: statusResult.error ? String(statusResult.error) : null,
        completedAt: statusResult.status === "finalized" || statusResult.status === "confirmed" ? new Date() : null,
      });
    } catch (historyErr) {
      console.error("[Swap History] Failed to update swap status:", historyErr);
    }
  }

  ctx.setTransactionStatus(statusResult.status);

  if (statusResult.status === "failed") {
    ctx.setExecuteError(
      getUserFriendlyErrorMessage(statusResult.error ?? new Error("Transaction failed"), {
        transactionType: "swap",
        provider: "jupiter",
      })
    );
  } else {
    const explorerLink = getExplorerUrlForSignature(sig, "solana");
    if (statusResult.status === "finalized") {
      ctx.setExecuteSuccess(`Swap finalized. View: ${explorerLink}`);
    } else {
      ctx.setExecuteSuccess(`Swap confirmed. View: ${explorerLink}`);
    }
    ctx.setTransactionStatus(null);
    ctx.setTransactionSignature(null);
  }
}
