import type { NormalizedQuote, SwapParams, SwapProvider, FeePayer, TradeType } from "@/types/swap";
import { costToUserRaw, effectiveReceiveRaw, netUserValueUsd } from "./quoteService";

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
    recipientAddress?: string;
  };
  quotes: Array<{
    provider: SwapProvider;
    expectedOut: string;
    expectedOutFormatted: string;
    fees: string;
    feeCurrency: string;
    feePayer: FeePayer;
    sponsorCost: string;
    recoupedSponsorCost?: string;
    worstCaseSponsorCostUsd?: number;
    userFee?: string;
    userFeeCurrency?: string;
    userFeeUsd?: number;
    gasless?: boolean;
    requiresSOL?: boolean;
    userReceivesUsd?: number;
    userPaysUsd?: number;
    netUserValueUsd?: number;
    solanaCostToUser?: string;
    effectiveReceive: string;
    costToUser: string;
  }>;
  best: {
    provider: SwapProvider;
    effectiveReceive: string;
    costToUser: string;
    sponsorCost: string;
    recoupedSponsorCost?: string;
    worstCaseSponsorCostUsd?: number;
    userFee?: string;
    userFeeCurrency?: string;
    userFeeUsd?: number;
    gasless?: boolean;
    requiresSOL?: boolean;
    userReceivesUsd?: number;
    userPaysUsd?: number;
    netUserValueUsd?: number;
    reason?: string;
    reasonChosenCode?: string;
    reasonChosenHuman?: string;
  } | null;
  evaluation: {
    tieBreakerApplied: boolean;
    thresholdUsed?: string;
  };
  /** Why this quote was chosen (app-level clarity for logs). */
  reasonChosen: { code: string; human: string };
}

const DEFAULT_LOG_PATH = "logs/quotes-accounting.jsonl";

function getLogPath(): string {
  return process.env.QUOTE_ACCOUNTING_LOG_PATH ?? DEFAULT_LOG_PATH;
}

async function ensureLogDirectory(logPath: string, fs: typeof import("fs").promises): Promise<void> {
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

export type QuoteEvaluationMeta = {
  tieBreakerApplied: boolean;
  thresholdUsed?: string;
  reasonChosen?: { code: string; human: string };
};

export async function logQuoteEvaluation(
  params: SwapParams,
  quotes: NormalizedQuote[],
  best: NormalizedQuote | null,
  evaluation: QuoteEvaluationMeta
): Promise<void> {
  const reasonChosen = evaluation.reasonChosen ?? { code: "unknown", human: "Unknown" };

  // App-level console: one clear picture per request (provider, fees, best, reason)
  const requestSummary = `${params.originChainId}→${params.destinationChainId} amount=${params.amount} ${params.tradeType}`;
  const quotesSummary = quotes
    .map((q) => {
      const eff = String(effectiveReceiveRaw(q));
      const feeStr = q.feePayer === "sponsor" && q.userFee ? `userFee=${q.userFee} ${q.userFeeCurrency ?? ""}` : `fees=${q.fees} ${q.feeCurrency}`;
      const gasless = q.gasless ? " gasless" : "";
      return `${q.provider}: effectiveReceive=${eff} ${feeStr}${gasless}`;
    })
    .join(" | ");
  const bestLine = best ? `best=${best.provider}` : "best=none";
  console.log(
    "[QUOTE]",
    requestSummary,
    "| quotes:",
    quotesSummary,
    "|",
    bestLine,
    "| reason:",
    reasonChosen.human
  );

  // Only log to file on server-side (where fs is available)
  if (typeof window !== "undefined") {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = await import("fs").then((m) => m.promises).catch(() => null);
    if (!fs) return;

    const logPath = getLogPath();
    await ensureLogDirectory(logPath, fs);

    const quoteEntries = quotes.map((q) => ({
      provider: q.provider,
      expectedOut: q.expectedOut,
      expectedOutFormatted: q.expectedOutFormatted,
      fees: q.fees,
      feeCurrency: q.feeCurrency,
      feePayer: q.feePayer,
      sponsorCost: q.sponsorCost,
      recoupedSponsorCost: q.recoupedSponsorCost,
      worstCaseSponsorCostUsd: q.worstCaseSponsorCostUsd,
      userFee: q.userFee,
      userFeeCurrency: q.userFeeCurrency,
      userFeeUsd: q.userFeeUsd,
      gasless: q.gasless,
      requiresSOL: q.requiresSOL,
      userReceivesUsd: q.userReceivesUsd,
      userPaysUsd: q.userPaysUsd,
      netUserValueUsd: netUserValueUsd(q),
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
          recoupedSponsorCost: best.recoupedSponsorCost,
          worstCaseSponsorCostUsd: best.worstCaseSponsorCostUsd,
          userFee: best.userFee,
          userFeeCurrency: best.userFeeCurrency,
          userFeeUsd: best.userFeeUsd,
          gasless: best.gasless,
          requiresSOL: best.requiresSOL,
          userReceivesUsd: best.userReceivesUsd,
          userPaysUsd: best.userPaysUsd,
          netUserValueUsd: netUserValueUsd(best),
          reason: reasonChosen.code,
          reasonChosenCode: reasonChosen.code,
          reasonChosenHuman: reasonChosen.human,
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
        recipientAddress: params.recipientAddress,
      },
      quotes: quoteEntries,
      best: bestEntry,
      evaluation: {
        tieBreakerApplied: evaluation.tieBreakerApplied,
        thresholdUsed: evaluation.thresholdUsed,
      },
      reasonChosen,
    };

    const line = JSON.stringify(entry) + "\n";
    await fs.appendFile(logPath, line, "utf8");
  } catch (err) {
    console.error("[quoteAccounting] Failed to log quote evaluation:", err);
  }
}
