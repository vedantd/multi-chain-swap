/**
 * Swap execution orchestrator: dispatches to Relay, deBridge, or Jupiter executor.
 * Pre-checks: quote expiry, deBridge transaction window.
 */

import { QUOTE_VALIDITY_MS } from "@/lib/constants";
import type { NormalizedQuote, SwapParams } from "@/types/swap";
import type { ExecutionContext } from "./types";
import { getDebridgeQuote } from "@/lib/debridge";
import { executeRelayQuote } from "./executeRelay";
import { executeDebridgeQuote } from "./executeDebridge";
import { executeJupiterQuote } from "./executeJupiter";

const DEBRIDGE_TRANSACTION_WINDOW_MS = 30_000;
const DEBRIDGE_WARNING_THRESHOLD_MS = 25_000;

export type { ExecutionContext, ExecutionSetters } from "./types";
export { executeRelayQuote } from "./executeRelay";
export { executeDebridgeQuote } from "./executeDebridge";
export { executeJupiterQuote } from "./executeJupiter";
export { deserializeBase64ToVersionedTransaction } from "./solanaTransaction";

/**
 * Execute a swap quote. Handles expiry check, deBridge age check, and dispatches to the correct provider.
 */
export async function executeQuote(
  quote: NormalizedQuote,
  params: SwapParams,
  ctx: ExecutionContext
): Promise<void> {
  if (Date.now() >= quote.expiryAt) {
    ctx.setExecuteError("Quote expired. Please fetch a new quote.");
    try {
      if (quote.provider === "relay") {
        await ctx.refetchQuotes();
      } else if (quote.provider === "debridge") {
        const freshQuote = await ctx.getDebridgeQuote(params);
        ctx.setSelectedQuote(freshQuote);
      }
    } catch {
      // Ignore refresh errors
    }
    return;
  }

  if (quote.provider === "debridge") {
    const quoteAge = Date.now() - (quote.expiryAt - QUOTE_VALIDITY_MS);
    if (quoteAge > DEBRIDGE_TRANSACTION_WINDOW_MS) {
      ctx.setExecuteError(
        "Quote is too old. Please fetch a new quote for better fulfillment probability."
      );
      return;
    }
    if (quoteAge > DEBRIDGE_WARNING_THRESHOLD_MS) {
      console.warn("[SwapPanel] deBridge quote age:", quoteAge, "ms - approaching expiry window");
    }
  }

  const raw = quote.raw as Record<string, unknown>;

  if (quote.provider === "relay" && raw?.steps) {
    await executeRelayQuote(quote, params, ctx);
    return;
  }
  if (quote.provider === "debridge" && raw?.tx) {
    await executeDebridgeQuote(quote, params, ctx);
    return;
  }
  if (quote.provider === "jupiter" && raw?.transaction && raw?.requestId) {
    await executeJupiterQuote(quote, params, ctx);
    return;
  }

  ctx.setExecuteError("Execution not implemented for this provider/chain. Check console for raw payload.");
  console.log("Quote raw payload:", raw);
}
