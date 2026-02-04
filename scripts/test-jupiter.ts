#!/usr/bin/env tsx
/**
 * Test script for Jupiter Ultra Swap API
 * 
 * Tests GET /ultra/v1/order with example Solana addresses and amounts.
 * Requires JUPITER_API_KEY in environment or .env.local file.
 * 
 * Usage:
 *   tsx scripts/test-jupiter.ts
 *   or
 *   npm run test:jupiter (if added to package.json)
 * 
 * To see full API responses:
 *   VERBOSE=true tsx scripts/test-jupiter.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
function loadEnvLocal(): void {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const envContent = readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  } catch (err) {
    // .env.local not found or can't read - use process.env as-is
  }
}

loadEnvLocal();

const JUPITER_ULTRA_BASE = "https://api.jup.ag/ultra/v1";

// Common Solana addresses and mints
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

// Example Solana wallet address (you can replace with your own)
const EXAMPLE_TAKER = "BQ72nSv9f3PRyRKCBnHLVrerrv37CYTHm5h3s9VSGQDV";

interface TestCase {
  name: string;
  inputMint: string;
  outputMint: string;
  amount: string; // Raw amount (lamports for SOL, smallest unit for tokens)
  taker?: string;
  receiver?: string;
}

const testCases: TestCase[] = [
  {
    name: "SOL → USDC (0.1 SOL)",
    inputMint: SOL_MINT,
    outputMint: USDC_MINT,
    amount: "100000000", // 0.1 SOL (9 decimals)
    taker: EXAMPLE_TAKER,
  },
  {
    name: "USDC → SOL (10 USDC)",
    inputMint: USDC_MINT,
    outputMint: SOL_MINT,
    amount: "10000000", // 10 USDC (6 decimals)
    taker: EXAMPLE_TAKER,
  },
  {
    name: "USDC → USDT (100 USDC)",
    inputMint: USDC_MINT,
    outputMint: USDT_MINT,
    amount: "100000000", // 100 USDC (6 decimals)
    taker: EXAMPLE_TAKER,
  },
];

async function testJupiterOrder(testCase: TestCase): Promise<void> {
  const apiKey = process.env.JUPITER_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("JUPITER_API_KEY is not set in .env.local");
  }

  const url = new URL(`${JUPITER_ULTRA_BASE}/order`);
  url.searchParams.set("inputMint", testCase.inputMint);
  url.searchParams.set("outputMint", testCase.outputMint);
  url.searchParams.set("amount", testCase.amount);
  if (testCase.taker) {
    url.searchParams.set("taker", testCase.taker);
  }
  if (testCase.receiver) {
    url.searchParams.set("receiver", testCase.receiver);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: ${testCase.name}`);
  console.log(`URL: ${url.toString().replace(apiKey, "***")}`);
  console.log(`Input: ${testCase.inputMint}`);
  console.log(`Output: ${testCase.outputMint}`);
  console.log(`Amount (raw): ${testCase.amount}`);

  try {
    const startTime = Date.now();
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
    });

    const elapsed = Date.now() - startTime;
    const data = await res.json();

    console.log(`\nStatus: ${res.status} ${res.statusText}`);
    console.log(`Response time: ${elapsed}ms`);

    if (!res.ok) {
      console.error("Error response:", JSON.stringify(data, null, 2));
      return;
    }

    // Pretty print key fields
    console.log("\n✅ Quote received:");
    console.log(`  - Input amount: ${data.inAmount}`);
    console.log(`  - Output amount: ${data.outAmount}`);
    console.log(`  - Output USD value: $${data.outUsdValue ?? "N/A"}`);
    console.log(`  - Price impact: ${data.priceImpactPct ?? data.priceImpact ?? "N/A"}%`);
    console.log(`  - Platform fee: ${data.platformFee?.amount ?? "0"} (${data.platformFee?.feeBps ?? 0} bps)`);
    console.log(`  - Fee mint: ${data.feeMint ?? "N/A"}`);
    console.log(`  - Gasless: ${data.gasless ? "Yes" : "No"}`);
    console.log(`  - Router: ${data.router ?? "N/A"}`);
    console.log(`  - Transaction present: ${data.transaction ? "Yes" : "No"}`);
    console.log(`  - Request ID: ${data.requestId ?? "N/A"}`);
    console.log(`  - Expires at: ${data.expireAt ?? "N/A"}`);

    if (data.transaction) {
      console.log(`  - Transaction length: ${data.transaction.length} chars (base64)`);
    }

    if (data.errorCode != null) {
      console.log(`\n⚠️  Warning: errorCode=${data.errorCode}, errorMessage=${data.errorMessage ?? "N/A"}`);
    }

    // Show route plan if available
    if (data.routePlan && Array.isArray(data.routePlan) && data.routePlan.length > 0) {
      console.log(`\n  Route plan (${data.routePlan.length} step(s)):`);
      data.routePlan.forEach((step: any, i: number) => {
        console.log(`    ${i + 1}. ${step.swapInfo?.label ?? "Unknown"} (${step.percent ?? 0}%)`);
      });
    }

    // Show fee breakdown
    if (data.signatureFeeLamports || data.prioritizationFeeLamports || data.rentFeeLamports) {
      console.log(`\n  Fee breakdown:`);
      if (data.signatureFeeLamports) {
        console.log(`    - Signature fee: ${data.signatureFeeLamports} lamports (payer: ${data.signatureFeePayer ?? "taker"})`);
      }
      if (data.prioritizationFeeLamports) {
        console.log(`    - Prioritization fee: ${data.prioritizationFeeLamports} lamports (payer: ${data.prioritizationFeePayer ?? "taker"})`);
      }
      if (data.rentFeeLamports) {
        console.log(`    - Rent fee: ${data.rentFeeLamports} lamports (payer: ${data.rentFeePayer ?? "taker"})`);
      }
    }

    // Full response (truncated if too long)
    if (process.env.VERBOSE === "true") {
      console.log("\n📄 Full response:");
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log("\n💡 Set VERBOSE=true to see full response");
    }
  } catch (err) {
    console.error(`\n❌ Request failed:`, err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
  }
}

async function main() {
  console.log("🚀 Jupiter Ultra Swap API Test Script");
  console.log("=".repeat(60));

  const apiKey = process.env.JUPITER_API_KEY;
  if (!apiKey?.trim()) {
    console.error("\n❌ Error: JUPITER_API_KEY is not set in .env.local");
    console.error("   Get your API key at: https://portal.jup.ag");
    process.exit(1);
  }

  console.log(`✅ API key found: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);

  // Run all test cases
  for (const testCase of testCases) {
    await testJupiterOrder(testCase);
    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ All tests completed!");
  console.log("\nNext steps:");
  console.log("  - Check the quotes above to verify Jupiter integration");
  console.log("  - Use the transaction + requestId for execute testing");
  console.log("  - Set VERBOSE=true to see full API responses");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
