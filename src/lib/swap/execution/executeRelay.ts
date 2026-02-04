/**
 * Execute a Relay quote: re-quote, send Solana transaction, poll status, poll bridge status.
 */

import type { NormalizedQuote, SwapParams } from "@/types/swap";
import type { ExecutionContext } from "./types";
import { deserializeBase64ToVersionedTransaction } from "./solanaTransaction";
import { createSwapRecordFromQuote, updateSwapStatus } from "@/lib/swap/history";
import { pollTransactionStatus, toSwapTransactionStatus } from "@/lib/solana/transactionStatus";
import { pollRelayBridgeStatus, mapRelayStatusToSwapStatus } from "@/lib/relay";
import { validateSponsorProfitability } from "@/lib/swap/quoteService";
import { getUserFriendlyErrorMessage, withRetry } from "@/lib/wallet/errors";
import { getExplorerUrlForSignature } from "@/lib/utils/explorerUrl";

async function fetchFreshRelayQuote(params: SwapParams): Promise<NormalizedQuote> {
  const res = await fetch("/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to re-quote Relay");
  const json = await res.json();
  if (!json.success || !json.data) throw new Error("Invalid response from quote API");
  const quotes = json.data.quotes as NormalizedQuote[];
  const relayQuote = quotes.find((q) => q.provider === "relay");
  if (!relayQuote) throw new Error("Relay quote no longer available");
  const validation = validateSponsorProfitability(relayQuote);
  if (!validation.valid) throw new Error(`Quote no longer valid: ${validation.reason}`);
  return relayQuote;
}

export async function executeRelayQuote(
  quote: NormalizedQuote,
  params: SwapParams,
  ctx: ExecutionContext
): Promise<void> {
  const { connection, sendTransaction } = ctx;
  if (!sendTransaction) {
    ctx.setExecuteError("Wallet does not support sending transactions.");
    return;
  }

  let quoteToExecute = quote;
  try {
    quoteToExecute = await withRetry(() => fetchFreshRelayQuote(params));
    ctx.setSelectedQuote(quoteToExecute);
  } catch (err) {
    ctx.setExecuteError(getUserFriendlyErrorMessage(err, { transactionType: "swap", provider: "relay" }));
    return;
  }

  const raw = quoteToExecute.raw as Record<string, unknown>;
  const steps = raw?.steps as Array<{
    requestId?: string;
    kind?: string;
    items?: Array<{ data?: Record<string, unknown> }>;
  }> | undefined;
  const firstStep = steps?.[0];
  const firstItem = firstStep?.items?.[0];
  const data = firstItem?.data;
  const base64 =
    data && (data.serializedTransaction ?? data.transaction)
      ? ((data.serializedTransaction as string) ?? (data.transaction as string))
      : null;

  const relayRequestId = firstStep?.requestId;

  if (!base64) {
    ctx.setTransactionStatus("failed");
    ctx.setExecuteError("Relay did not return a transaction. Please try again or use a different route.");
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
    console.error("Relay Solana send failed:", err);
    ctx.setExecuteError(getUserFriendlyErrorMessage(err, { transactionType: "swap", provider: "relay" }));
    return;
  }

  ctx.setTransactionSignature(sig);

  let swapRecordId: string | null = null;
  try {
    const swapRecord = createSwapRecordFromQuote(quoteToExecute, params, sig, relayRequestId, null);
    swapRecordId = swapRecord.id;
  } catch (historyErr) {
    console.error("[Swap History] Failed to create swap record:", historyErr);
  }

  ctx.setTransactionStatus("pending");
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
        provider: "relay",
      })
    );
    return;
  }

  if (relayRequestId && swapRecordId) {
    try {
      ctx.setTransactionStatus("pending");
      const bridgeStatus = await pollRelayBridgeStatus(relayRequestId);
      const swapStatus = mapRelayStatusToSwapStatus(bridgeStatus.status);

      try {
        updateSwapStatus({
          id: swapRecordId,
          status: swapStatus,
          destinationTransactionHash: bridgeStatus.txHashes?.[0],
          errorMessage:
            bridgeStatus.error ??
            (bridgeStatus.status === "failure" || bridgeStatus.status === "refund" ? "Bridge failed or refunded" : null),
          completedAt: bridgeStatus.status === "success" ? new Date() : null,
        });
      } catch (historyErr) {
        console.error("[Swap History] Failed to update bridge status:", historyErr);
      }

      if (bridgeStatus.status === "success") {
        const destinationTxHash = bridgeStatus.txHashes?.[0];
        const successMessage = destinationTxHash
          ? `Bridge completed successfully! Origin: ${sig.slice(0, 8)}... Destination: ${destinationTxHash.slice(0, 8)}...`
          : `Bridge completed successfully! Origin tx: ${sig}`;
        ctx.setExecuteSuccess(successMessage);
        ctx.setTransactionStatus(null);
        ctx.setTransactionSignature(null);
      } else if (bridgeStatus.status === "refund") {
        ctx.setExecuteError("Bridge failed and funds were refunded. Check your wallet.");
        ctx.setTransactionStatus("failed");
      } else if (bridgeStatus.status === "failure") {
        ctx.setExecuteError(bridgeStatus.error ?? "Bridge failed. Check transaction status.");
        ctx.setTransactionStatus("failed");
      } else {
        ctx.setExecuteSuccess(`Origin transaction confirmed. Bridge in progress... View: ${getExplorerUrlForSignature(sig, "solana")}`);
        ctx.setTransactionStatus(null);
        ctx.setTransactionSignature(null);
      }
    } catch (bridgeErr) {
      console.error("[Relay Bridge] Error monitoring bridge status:", bridgeErr);
      ctx.setExecuteSuccess(`Transaction confirmed. Bridge in progress... View: ${getExplorerUrlForSignature(sig, "solana")}`);
      ctx.setTransactionStatus(null);
      ctx.setTransactionSignature(null);
    }
  } else {
    if (statusResult.status === "finalized") {
      ctx.setExecuteSuccess(`Transaction finalized. View: ${getExplorerUrlForSignature(sig, "solana")}`);
    } else if (statusResult.status === "confirmed") {
      ctx.setExecuteSuccess(`Transaction confirmed. View: ${getExplorerUrlForSignature(sig, "solana")}`);
    }
    ctx.setTransactionStatus(null);
    ctx.setTransactionSignature(null);
  }
}
