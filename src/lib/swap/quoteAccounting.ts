import { promises as fs } from "fs";
import type { NormalizedQuote, SwapParams, SwapProvider, FeePayer, TradeType } from "@/types/swap";
import { costToUserRaw, effectiveReceiveRaw } from "./quoteService";

export interface QuoteAccountingEntry {
  timestamp: string;
  requestId?: string;
  request: {
    originChainId: number;
    destinationChainId: number;
    originToken: string;
    destinationToken: string;
    amount: string;
    tradeType: TradeType;
    userAddress: string;
    depositFeePayer?: string;
  };
  quotes: Array<{
    provider: SwapProvider;
    expectedOut: string;
    expectedOutFormatted: string;
    fees: string;
    feeCurrency: string;
    feePayer: FeePayer;
    sponsorCost: string;
    solanaCostToUser?: string;
    effectiveReceive: string;
    costToUser: string;
  }>;
  best: {
    provider: SwapProvider;
    effectiveReceive: string;
    costToUser: string;
    sponsorCost: string;
    reason?: string;
  } | null;
  evaluation: {
    tieBreakerApplied: boolean;
    thresholdUsed?: string;
  };
}

const DEFAULT_LOG_PATH = "logs/quotes-accounting.jsonl";

function getLogPath(): string {
  return process.env.QUOTE_ACCOUNTING_LOG_PATH ?? DEFAULT_LOG_PATH;
}

async function ensureLogDirectory(logPath: string): Promise<void> {
  const dir = logPath.includes("/") ? logPath.substring(0, logPath.lastIndexOf("/")) : ".";
  if (dir !== ".") {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
        throw err;
      }
    }
  }
}

export async function logQuoteEvaluation(
  params: SwapParams,
  quotes: NormalizedQuote[],
  best: NormalizedQuote | null,
  evaluation: { tieBreakerApplied: boolean; thresholdUsed?: string }
): Promise<void> {
  try {
    const logPath = getLogPath();
    await ensureLogDirectory(logPath);

    const quoteEntries = quotes.map((q) => ({
      provider: q.provider,
      expectedOut: q.expectedOut,
      expectedOutFormatted: q.expectedOutFormatted,
      fees: q.fees,
      feeCurrency: q.feeCurrency,
      feePayer: q.feePayer,
      sponsorCost: q.sponsorCost,
      solanaCostToUser: q.solanaCostToUser,
      effectiveReceive: String(effectiveReceiveRaw(q)),
      costToUser: String(costToUserRaw(q)),
    }));

    const bestEntry = best
      ? {
          provider: best.provider,
          effectiveReceive: String(effectiveReceiveRaw(best)),
          costToUser: String(costToUserRaw(best)),
          sponsorCost: best.sponsorCost,
          reason: evaluation.tieBreakerApplied ? "tie_breaker_relay" : "highest_effective_receive",
        }
      : null;

    const entry: QuoteAccountingEntry = {
      timestamp: new Date().toISOString(),
      request: {
        originChainId: params.originChainId,
        destinationChainId: params.destinationChainId,
        originToken: params.originToken,
        destinationToken: params.destinationToken,
        amount: params.amount,
        tradeType: params.tradeType,
        userAddress: params.userAddress,
        depositFeePayer: params.depositFeePayer,
      },
      quotes: quoteEntries,
      best: bestEntry,
      evaluation: {
        tieBreakerApplied: evaluation.tieBreakerApplied,
        thresholdUsed: evaluation.thresholdUsed,
      },
    };

    const line = JSON.stringify(entry) + "\n";
    await fs.appendFile(logPath, line, "utf8");
  } catch (err) {
    console.error("[quoteAccounting] Failed to log quote evaluation:", err);
  }
}
