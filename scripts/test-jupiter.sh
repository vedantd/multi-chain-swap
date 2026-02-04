#!/bin/bash
# Simple curl-based test script for Jupiter Ultra Swap API
# Reads JUPITER_API_KEY from .env.local
#
# Usage:
#   bash scripts/test-jupiter.sh
#   or
#   ./scripts/test-jupiter.sh

set -e

# Load JUPITER_API_KEY from .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | grep JUPITER_API_KEY | xargs)
fi

if [ -z "$JUPITER_API_KEY" ]; then
  echo "❌ Error: JUPITER_API_KEY not found in .env.local"
  echo "   Get your API key at: https://portal.jup.ag"
  exit 1
fi

echo "🚀 Jupiter Ultra Swap API Test (curl)"
echo "============================================================"
echo "API Key: ${JUPITER_API_KEY:0:8}...${JUPITER_API_KEY: -4}"
echo ""

# Common mints
SOL_MINT="So11111111111111111111111111111111111111112"
USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
USDT_MINT="Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
EXAMPLE_TAKER="BQ72nSv9f3PRyRKCBnHLVrerrv37CYTHm5h3s9VSGQDV"

BASE_URL="https://api.jup.ag/ultra/v1"

# Test 1: SOL → USDC
echo "Test 1: SOL → USDC (0.1 SOL)"
echo "------------------------------------------------------------"
curl -s -X GET \
  "${BASE_URL}/order?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=100000000&taker=${EXAMPLE_TAKER}" \
  -H "x-api-key: ${JUPITER_API_KEY}" \
  -H "Content-Type: application/json" | jq '{
    inAmount,
    outAmount,
    outUsdValue,
    priceImpactPct,
    platformFee,
    feeMint,
    gasless,
    router,
    hasTransaction: (.transaction != null),
    requestId,
    expireAt
  }' || echo "Response received (install jq for pretty JSON)"
echo ""

# Test 2: USDC → SOL
echo "Test 2: USDC → SOL (10 USDC)"
echo "------------------------------------------------------------"
curl -s -X GET \
  "${BASE_URL}/order?inputMint=${USDC_MINT}&outputMint=${SOL_MINT}&amount=10000000&taker=${EXAMPLE_TAKER}" \
  -H "x-api-key: ${JUPITER_API_KEY}" \
  -H "Content-Type: application/json" | jq '{
    inAmount,
    outAmount,
    outUsdValue,
    priceImpactPct,
    platformFee,
    feeMint,
    gasless,
    router,
    hasTransaction: (.transaction != null),
    requestId,
    errorCode,
    errorMessage
  }' || echo "Response received (install jq for pretty JSON)"
echo ""

# Test 3: USDC → USDT
echo "Test 3: USDC → USDT (100 USDC)"
echo "------------------------------------------------------------"
curl -s -X GET \
  "${BASE_URL}/order?inputMint=${USDC_MINT}&outputMint=${USDT_MINT}&amount=100000000&taker=${EXAMPLE_TAKER}" \
  -H "x-api-key: ${JUPITER_API_KEY}" \
  -H "Content-Type: application/json" | jq '{
    inAmount,
    outAmount,
    outUsdValue,
    priceImpactPct,
    platformFee,
    feeMint,
    gasless,
    router,
    hasTransaction: (.transaction != null),
    requestId,
    errorCode,
    errorMessage
  }' || echo "Response received (install jq for pretty JSON)"
echo ""

echo "============================================================"
echo "✅ Tests completed!"
echo ""
echo "To see full responses, use:"
echo "  curl -s -X GET \"${BASE_URL}/order?inputMint=...&outputMint=...&amount=...&taker=...\" \\"
echo "    -H \"x-api-key: \${JUPITER_API_KEY}\" | jq"
