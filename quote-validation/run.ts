/**
 * Quote validation: real API getQuotes runs, routing checks, UI display check, fee breakdown, CSV output.
 * Run: npx tsx -r tsconfig-paths/register quote-validation/run.ts
 * Target: ~150 calls, 10s sleep between batches, total ~5–6 minutes.
 */

import * as fs from "fs";
import * as path from "path";
import {
  getQuotes,
  effectiveReceiveRaw,
  costToUserRaw,
  sortByBest,
} from "@/lib/swap/quoteService";
import type { NormalizedQuote, SwapParams } from "@/types/swap";
import {
  TOKENS_BY_CHAIN,
  DESTINATION_CHAIN_IDS,
  CHAIN_ID_SOLANA,
  formatRawAmountWithDecimals,
  isEvmChain,
} from "@/lib/chainConfig";

/** EVM destination requires 0x recipient; use a test address for validation. */
const EVM_RECIPIENT_PLACEHOLDER = "0x0000000000000000000000000000000000000001";

function ensureRecipientForDestination(params: SwapParams): SwapParams {
  if (isEvmChain(params.destinationChainId) && !params.recipientAddress) {
    return { ...params, recipientAddress: EVM_RECIPIENT_PLACEHOLDER };
  }
  return params;
}
import {
  BATCH_SIZE,
  SLEEP_BETWEEN_BATCHES_MS,
  TARGET_TOTAL_CALLS,
  QUOTES_ACCOUNTING_PATH,
  OUTPUT_DIR,
  MOCK_USER_SOL_BALANCE,
  PRICE_SANITY_TOLERANCE_STABLECOIN,
  COINGECKO_SIMPLE_PRICE_URL,
} from "./config";

const STABLECOIN_SYMBOLS = new Set(["USDC", "USDT"]);

type Category = "stablecoin" | "non-stablecoin";

interface LogEntry {
  request: {
    originChainId: number;
    destinationChainId: number;
    originToken: string;
    destinationToken: string;
    amount: string;
    tradeType: string;
    userAddress: string;
    depositFeePayer?: string;
  };
}

function getSymbol(chainId: number, tokenAddress: string): string | null {
  const tokens = TOKENS_BY_CHAIN[chainId] ?? [];
  const t = tokens.find(
    (x) => x.address.toLowerCase() === tokenAddress.toLowerCase()
  );
  return t?.symbol ?? null;
}

function isStablecoinRoute(originChainId: number, originToken: string, destinationChainId: number, destinationToken: string): boolean {
  const oSym = getSymbol(originChainId, originToken);
  const dSym = getSymbol(destinationChainId, destinationToken);
  return (
    oSym !== null &&
    dSym !== null &&
    STABLECOIN_SYMBOLS.has(oSym) &&
    STABLECOIN_SYMBOLS.has(dSym)
  );
}

function categorize(params: SwapParams): Category {
  return isStablecoinRoute(
    params.originChainId,
    params.originToken,
    params.destinationChainId,
    params.destinationToken
  )
    ? "stablecoin"
    : "non-stablecoin";
}

/** Replicate UI effectiveReceiveFormatted from SwapPanel. */
function computeEffectiveReceiveFormatted(q: NormalizedQuote): string {
  const effectiveReceive = effectiveReceiveRaw(q);
  const expectedOutNum = BigInt(q.expectedOut);
  const expectedOutFormattedNum = parseFloat(q.expectedOutFormatted);
  const useRatio =
    expectedOutNum > BigInt(0) &&
    Number.isFinite(expectedOutFormattedNum) &&
    expectedOutFormattedNum >= 0;
  if (!useRatio)
    return formatRawAmountWithDecimals(String(effectiveReceive), 6);
  const ratio = Number(effectiveReceive) / Number(expectedOutNum);
  const value = ratio * expectedOutFormattedNum;
  if (!Number.isFinite(value) || value < 0) return "0";
  return value >= 1e9
    ? String(Math.round(value))
    : value.toFixed(6).replace(/\.?0+$/, "");
}

function parseLog(pathToLog: string): LogEntry[] {
  const fullPath = path.isAbsolute(pathToLog)
    ? pathToLog
    : path.join(process.cwd(), pathToLog);
  if (!fs.existsSync(fullPath)) return [];
  const content = fs.readFileSync(fullPath, "utf8");
  const lines = content.trim().split("\n").filter(Boolean);
  const entries: LogEntry[] = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as LogEntry;
      if (entry?.request) entries.push(entry);
    } catch {
      // skip malformed lines
    }
  }
  return entries;
}

/** Dedupe by (originChainId, destinationChainId, originToken, destinationToken, amount). */
function uniqueRequestShapes(entries: LogEntry[]): SwapParams[] {
  const seen = new Set<string>();
  const params: SwapParams[] = [];
  for (const e of entries) {
    const r = e.request;
    const key = `${r.originChainId}|${r.destinationChainId}|${r.originToken}|${r.destinationToken}|${r.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    params.push({
      originChainId: r.originChainId,
      destinationChainId: r.destinationChainId,
      originToken: r.originToken,
      destinationToken: r.destinationToken,
      amount: r.amount,
      tradeType: (r.tradeType as SwapParams["tradeType"]) ?? "exact_in",
      userAddress: r.userAddress,
      depositFeePayer: r.depositFeePayer,
    });
  }
  return params;
}

/** Pick a few wallet addresses from log for variety. */
function walletAddressesFromLog(entries: LogEntry[], max: number): string[] {
  const set = new Set<string>();
  for (const e of entries) {
    if (e.request.userAddress) set.add(e.request.userAddress);
    if (e.request.depositFeePayer) set.add(e.request.depositFeePayer);
  }
  return Array.from(set).slice(0, max);
}

/** Build more variations: different amounts and chain pairs from TOKENS_BY_CHAIN. */
function buildVariations(seedParams: SwapParams[], wallets: string[]): SwapParams[] {
  const out: SwapParams[] = [];
  const amountMultipliers = ["1", "10", "50", "100", "500", "1000"];
  const chains = DESTINATION_CHAIN_IDS.filter((c) => c !== CHAIN_ID_SOLANA);
  const solChain = CHAIN_ID_SOLANA;
  const solTokens = TOKENS_BY_CHAIN[solChain] ?? [];
  const baseAmountsByDecimals: Record<number, string[]> = {
    6: ["1000000", "10000000", "50000000", "100000000", "1500000000", "18000000"],
    9: ["100000000000", "500000000000", "1000000000000", "1500000000000"],
    18: ["1000000000000000000", "5000000000000000000"],
  };

  // 1) Add all unique seeds
  const seen = new Set<string>();
  for (const p of seedParams) {
    const key = `${p.originChainId}|${p.destinationChainId}|${p.originToken}|${p.destinationToken}|${p.amount}`;
    if (!seen.has(key)) {
      seen.add(key);
      const withWallet = { ...p, userAddress: wallets[0] ?? p.userAddress, depositFeePayer: wallets[0] ?? p.depositFeePayer };
      out.push(ensureRecipientForDestination(withWallet));
    }
  }

  // 2) Solana USDC -> each EVM USDC with several amounts
  for (const destChainId of chains) {
    const destTokens = TOKENS_BY_CHAIN[destChainId] ?? [];
    const usdcSol = solTokens.find((t) => t.symbol === "USDC");
    const usdcDest = destTokens.find((t) => t.symbol === "USDC");
    if (!usdcSol || !usdcDest) continue;
    const decimals = 6;
    const amounts = baseAmountsByDecimals[decimals] ?? ["10000000"];
    for (const amount of amounts) {
      const key = `${solChain}|${destChainId}|${usdcSol.address}|${usdcDest.address}|${amount}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(
        ensureRecipientForDestination({
          originChainId: solChain,
          destinationChainId: destChainId,
          originToken: usdcSol.address,
          destinationToken: usdcDest.address,
          amount,
          tradeType: "exact_in",
          userAddress: wallets[0] ?? "9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u",
          depositFeePayer: wallets[0],
        })
      );
    }
  }

  // 3) Solana SOL -> EVM USDC (non-stablecoin)
  const solToken = solTokens.find((t) => t.symbol === "SOL");
  if (solToken) {
    for (const destChainId of chains) {
      const destTokens = TOKENS_BY_CHAIN[destChainId] ?? [];
      const usdcDest = destTokens.find((t) => t.symbol === "USDC");
      if (!usdcDest) continue;
      for (const amount of baseAmountsByDecimals[9] ?? ["100000000000"]) {
        const key = `${solChain}|${destChainId}|${solToken.address}|${usdcDest.address}|${amount}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(
          ensureRecipientForDestination({
            originChainId: solChain,
            destinationChainId: destChainId,
            originToken: solToken.address,
            destinationToken: usdcDest.address,
            amount,
            tradeType: "exact_in",
            userAddress: wallets[0] ?? "FyUAJe6qmi7rG7c1tD2GV6td6KoFo57rbSZ1JBSCSidU",
            depositFeePayer: wallets[0],
          })
        );
      }
    }
  }

  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fetch USD prices for a few ids (e.g. solana, ethereum, usd-coin). */
async function fetchPrices(ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  try {
    const url = `${COINGECKO_SIMPLE_PRICE_URL}?ids=${ids.join(",")}&vs_currencies=usd`;
    const res = await fetch(url);
    if (!res.ok) return {};
    const data = (await res.json()) as Record<string, { usd?: number }>;
    const out: Record<string, number> = {};
    for (const id of ids) {
      const v = data[id]?.usd;
      if (typeof v === "number") out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Map chainId + symbol to CoinGecko id for simple/price. */
function coingeckoId(symbol: string, _chainId: number): string | null {
  const m: Record<string, string> = {
    USDC: "usd-coin",
    USDT: "tether",
    SOL: "solana",
    ETH: "ethereum",
    WETH: "weth",
    BNB: "binancecoin",
    MATIC: "matic-network",
    AVAX: "avalanche-2",
  };
  return m[symbol] ?? null;
}

interface Row {
  runId: string;
  index: number;
  category: Category;
  originChainId: number;
  destinationChainId: number;
  originTokenAddress: string;
  destinationTokenAddress: string;
  originTokenSymbol: string;
  destinationTokenSymbol: string;
  amountRaw: string;
  amountHuman: string;
  bestProvider: string;
  effectiveReceiveRaw: string;
  effectiveReceiveFormattedUI: string;
  costToUser: string;
  fees: string;
  sponsorCost: string;
  solanaCostToUser: string;
  feeCurrency: string;
  userFee: string;
  userFeeCurrency: string;
  reasonChosen: string;
  priceSanityStatus: string;
  priceInputUSD: string;
  priceOutputUSD: string;
  priceDiffPercent: string;
  durationMs: number;
  error: string;
  bestInQuotes: string;
  bestIsMaxEffectiveReceive: string;
}

function escapeCsv(s: string): string {
  const needsQuotes = /[",\n\r]/.test(s);
  if (!needsQuotes) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function rowToCsvLine(row: Row): string {
  const cols = [
    row.runId,
    row.index,
    row.category,
    row.originChainId,
    row.destinationChainId,
    row.originTokenAddress,
    row.destinationTokenAddress,
    row.originTokenSymbol,
    row.destinationTokenSymbol,
    row.amountRaw,
    row.amountHuman,
    row.bestProvider,
    row.effectiveReceiveRaw,
    row.effectiveReceiveFormattedUI,
    row.costToUser,
    row.fees,
    row.sponsorCost,
    row.solanaCostToUser,
    row.feeCurrency,
    row.userFee,
    row.userFeeCurrency,
    row.reasonChosen,
    row.priceSanityStatus,
    row.priceInputUSD,
    row.priceOutputUSD,
    row.priceDiffPercent,
    row.durationMs,
    row.error,
    row.bestInQuotes,
    row.bestIsMaxEffectiveReceive,
  ];
  return cols.map((c) => escapeCsv(String(c))).join(",");
}

async function main(): Promise<void> {
  const runId = `run-${Date.now()}`;
  console.log("[quote-validation] Run ID:", runId);
  console.log("[quote-validation] Reading seed log:", QUOTES_ACCOUNTING_PATH);

  const entries = parseLog(QUOTES_ACCOUNTING_PATH);
  const seedParams = uniqueRequestShapes(entries);
  const wallets = walletAddressesFromLog(entries, 5);
  if (wallets.length === 0) wallets.push("9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u", "FyUAJe6qmi7rG7c1tD2GV6td6KoFo57rbSZ1JBSCSidU");

  let testParams = buildVariations(seedParams, wallets);
  const limit = Math.min(testParams.length, TARGET_TOTAL_CALLS);
  if (testParams.length > limit) {
    testParams = testParams.slice(0, limit);
  } else {
    // Pad with more seeds with different amounts to approach TARGET_TOTAL_CALLS
    while (testParams.length < TARGET_TOTAL_CALLS && seedParams.length > 0) {
      const p = seedParams[testParams.length % seedParams.length]!;
      const amounts = ["1000000", "5000000", "10000000", "20000000", "100000000"];
      const amount = amounts[testParams.length % amounts.length]!;
      testParams.push(
        ensureRecipientForDestination({
          ...p,
          amount,
          userAddress: wallets[testParams.length % wallets.length] ?? wallets[0]!,
          depositFeePayer: wallets[testParams.length % wallets.length] ?? wallets[0],
        })
      );
    }
    testParams = testParams.slice(0, TARGET_TOTAL_CALLS);
  }

  console.log("[quote-validation] Test cases:", testParams.length, "batches of", BATCH_SIZE, "sleep", SLEEP_BETWEEN_BATCHES_MS, "ms");

  const rows: Row[] = [];
  const batches: SwapParams[][] = [];
  for (let i = 0; i < testParams.length; i += BATCH_SIZE) {
    batches.push(testParams.slice(i, i + BATCH_SIZE));
  }

  let priceCache: Record<string, number> = {};
  const priceIds = ["usd-coin", "solana", "ethereum"];
  try {
    priceCache = await fetchPrices(priceIds);
  } catch {
    // optional
  }

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b]!;
    const startBatch = Date.now();
    const results = await Promise.allSettled(
      batch.map((params) =>
        getQuotes(
          params,
          undefined,
          MOCK_USER_SOL_BALANCE,
          undefined
        )
      )
    );
    const batchElapsed = Date.now() - startBatch;

    for (let i = 0; i < batch.length; i++) {
      const params = batch[i]!;
      const result = results[i]!;
      const globalIndex = b * BATCH_SIZE + i;
      const cat = categorize(params);
      const originSymbol = getSymbol(params.originChainId, params.originToken) ?? "";
      const destSymbol = getSymbol(params.destinationChainId, params.destinationToken) ?? "";
      const originDecimals = TOKENS_BY_CHAIN[params.originChainId]?.find((t) => t.address === params.originToken)?.decimals ?? 6;
      const amountHuman = (Number(params.amount) / 10 ** originDecimals).toFixed(6);

      const emptyRow = (error: string): Row => ({
        runId,
        index: globalIndex,
        category: cat,
        originChainId: params.originChainId,
        destinationChainId: params.destinationChainId,
        originTokenAddress: params.originToken,
        destinationTokenAddress: params.destinationToken,
        originTokenSymbol: originSymbol,
        destinationTokenSymbol: destSymbol,
        amountRaw: params.amount,
        amountHuman,
        bestProvider: "",
        effectiveReceiveRaw: "",
        effectiveReceiveFormattedUI: "",
        costToUser: "",
        fees: "",
        sponsorCost: "",
        solanaCostToUser: "",
        feeCurrency: "",
        userFee: "",
        userFeeCurrency: "",
        reasonChosen: "",
        priceSanityStatus: "N/A",
        priceInputUSD: "",
        priceOutputUSD: "",
        priceDiffPercent: "",
        durationMs: 0,
        error: error.slice(0, 500),
        bestInQuotes: "",
        bestIsMaxEffectiveReceive: "",
      });

      if (result.status === "rejected") {
        rows.push(emptyRow(result.reason?.message ?? String(result.reason)));
        continue;
      }

      const data = result.value;
      const best = data.best;
      const quotes = data.quotes;
      const durationMs = batchElapsed; // approximate per-call

      let bestInQuotes = "false";
      let bestIsMaxEffectiveReceive = "false";
      let bestProvider = "";
      let effectiveReceiveRawStr = "";
      let effectiveReceiveFormattedUI = "";
      let costToUser = "";
      let fees = "";
      let sponsorCost = "";
      let solanaCostToUser = "";
      let feeCurrency = "";
      let userFee = "";
      let userFeeCurrency = "";
      let reasonChosen = "";

      if (best && quotes.length > 0) {
        bestInQuotes = quotes.some((q) => q.provider === best.provider && q.expectedOut === best.expectedOut) ? "true" : "false";
        const sorted = sortByBest(quotes, params);
        const maxEff = sorted[0];
        const bestEff = effectiveReceiveRaw(best);
        bestIsMaxEffectiveReceive = maxEff && effectiveReceiveRaw(maxEff) === bestEff ? "true" : "false";
        bestProvider = best.provider;
        effectiveReceiveRawStr = String(bestEff);
        effectiveReceiveFormattedUI = computeEffectiveReceiveFormatted(best);
        costToUser = String(costToUserRaw(best));
        fees = best.fees;
        sponsorCost = best.sponsorCost;
        solanaCostToUser = best.solanaCostToUser ?? "";
        feeCurrency = best.feeCurrency;
        userFee = best.userFee ?? "";
        userFeeCurrency = best.userFeeCurrency ?? "";
        reasonChosen = "highest_effective_receive";
      }

      let priceSanityStatus = "N/A";
      let priceInputUSD = "";
      let priceOutputUSD = "";
      let priceDiffPercent = "";

      if (best && cat === "stablecoin" && Number(effectiveReceiveRawStr) > 0) {
        const inUsd = Number(amountHuman) * (priceCache["usd-coin"] ?? 1);
        const destDecimals = TOKENS_BY_CHAIN[params.destinationChainId]?.find((t) => t.address === params.destinationToken)?.decimals ?? 6;
        const outHuman = Number(effectiveReceiveRawStr) / 10 ** destDecimals;
        const outUsd = outHuman * (priceCache["usd-coin"] ?? 1);
        priceInputUSD = inUsd.toFixed(4);
        priceOutputUSD = outUsd.toFixed(4);
        const diff = inUsd > 0 ? Math.abs(inUsd - outUsd) / inUsd : 0;
        priceDiffPercent = (diff * 100).toFixed(4);
        if (diff <= PRICE_SANITY_TOLERANCE_STABLECOIN) priceSanityStatus = "OK";
        else if (diff <= 0.10) priceSanityStatus = "WARN";
        else priceSanityStatus = "FAIL";
      }

      rows.push({
        runId,
        index: globalIndex,
        category: cat,
        originChainId: params.originChainId,
        destinationChainId: params.destinationChainId,
        originTokenAddress: params.originToken,
        destinationTokenAddress: params.destinationToken,
        originTokenSymbol: originSymbol,
        destinationTokenSymbol: destSymbol,
        amountRaw: params.amount,
        amountHuman,
        bestProvider,
        effectiveReceiveRaw: effectiveReceiveRawStr,
        effectiveReceiveFormattedUI,
        costToUser,
        fees,
        sponsorCost,
        solanaCostToUser,
        feeCurrency,
        userFee,
        userFeeCurrency,
        reasonChosen,
        priceSanityStatus,
        priceInputUSD,
        priceOutputUSD,
        priceDiffPercent,
        durationMs,
        error: "",
        bestInQuotes,
        bestIsMaxEffectiveReceive,
      });
    }

    if (b < batches.length - 1) {
      console.log("[quote-validation] Batch", b + 1, "/", batches.length, "done; sleeping", SLEEP_BETWEEN_BATCHES_MS, "ms");
      await sleep(SLEEP_BETWEEN_BATCHES_MS);
    }
  }

  const header =
    "runId,index,category,originChainId,destinationChainId,originTokenAddress,destinationTokenAddress,originTokenSymbol,destinationTokenSymbol,amountRaw,amountHuman,bestProvider,effectiveReceiveRaw,effectiveReceiveFormattedUI,costToUser,fees,sponsorCost,solanaCostToUser,feeCurrency,userFee,userFeeCurrency,reasonChosen,priceSanityStatus,priceInputUSD,priceOutputUSD,priceDiffPercent,durationMs,error,bestInQuotes,bestIsMaxEffectiveReceive";

  const outPath = path.join(process.cwd(), OUTPUT_DIR);
  if (!fs.existsSync(outPath)) {
    fs.mkdirSync(outPath, { recursive: true });
  }
  const csvPath = path.join(outPath, `quote-validation-${runId}.csv`);
  const csvContent = [header, ...rows.map(rowToCsvLine)].join("\n");
  fs.writeFileSync(csvPath, csvContent, "utf8");

  const withError = rows.filter((r) => r.error).length;
  const okBest = rows.filter((r) => r.bestIsMaxEffectiveReceive === "true").length;
  const failPrice = rows.filter((r) => r.priceSanityStatus === "FAIL").length;

  const summaryPath = path.join(outPath, "latest-run-summary.txt");
  const summary = [
    `runId=${runId}`,
    `timestamp=${new Date().toISOString()}`,
    `totalRows=${rows.length}`,
    `errors=${withError}`,
    `bestIsMaxEffectiveReceive=${okBest}/${rows.length}`,
    `priceSanityFAIL=${failPrice}`,
  ].join("\n");
  fs.writeFileSync(summaryPath, summary, "utf8");

  console.log("[quote-validation] Wrote", rows.length, "rows to", csvPath);
  console.log("[quote-validation] Summary written to", summaryPath);
  console.log("[quote-validation] Errors:", withError, "| Best is max effective receive:", okBest, "/", rows.length, "| Price sanity FAIL:", failPrice);
}

main().catch((err) => {
  console.error("[quote-validation] Fatal:", err);
  process.exit(1);
});
