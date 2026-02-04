# API Documentation

## Overview

The Multi-Chain Swap API provides a single endpoint for fetching cross-chain swap quotes from multiple bridge providers (Relay and deBridge). The API normalizes provider-specific responses into a consistent format for easy comparison and selection.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: Your deployed domain

## Endpoint

### `POST /api/quotes`

Fetches quotes from Relay and deBridge providers for a given swap request.

#### Request Headers

```
Content-Type: application/json
```

#### Request Body

```typescript
{
  // Required fields
  originChainId: number;           // Chain ID of origin chain (Solana = 7565164)
  destinationChainId: number;      // Chain ID of destination chain
  originToken: string;              // Token address on origin chain
  destinationToken: string;         // Token address on destination chain
  amount: string;                   // Amount in raw units (smallest denomination)
  userAddress: string;              // Solana wallet address (base58)

  // Optional fields
  recipientAddress?: string;        // EVM address for EVM destinations (0x...)
  tradeType?: "exact_in" | "exact_out";  // Default: "exact_in"
  depositFeePayer?: string;        // Solana address for fee sponsorship
  
  // Optional optimization fields (reduce RPC calls)
  userSOLBalance?: string;         // User's SOL balance in lamports
  userSolanaUSDCBalance?: string;  // User's USDC balance on Solana (raw units)
}
```

#### Chain IDs

| Chain | Chain ID (Internal) |
|-------|-------------------|
| Solana | `7565164` |
| Ethereum | `1` |
| Optimism | `10` |
| BNB Chain | `56` |
| Polygon | `137` |
| Base | `8453` |
| Arbitrum | `42161` |
| Avalanche | `43114` |

**Note**: Chain ID mapping is handled automatically. The internal Solana chain ID is `7565164` (matches deBridge). Relay uses a different chain ID (`792703809`) internally, but the system automatically maps between internal and provider-specific IDs. Always use the internal chain IDs shown above in API requests.

#### Token Addresses

Common token addresses:

**Solana:**
- SOL: `So11111111111111111111111111111111111111112`
- USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

**Ethereum:**
- ETH: `0x0000000000000000000000000000000000000000`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`

**Base:**
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- WETH: `0x4200000000000000000000000000000000000006`

#### Response Format

**Success Response** (200 OK):

```typescript
{
  success: true;
  data: {
    quotes: NormalizedQuote[];
    best: NormalizedQuote | null;
  };
}
```

**Error Response** (400/502):

```typescript
{
  success: false;
  error: {
    code: "VALIDATION_ERROR" | "NEED_SOL_FOR_GAS" | "QUOTE_ERROR";
    message: string;
  };
}
```

#### NormalizedQuote Type

```typescript
interface NormalizedQuote {
  provider: "relay" | "debridge";
  expectedOut: string;              // Raw amount user receives
  expectedOutFormatted: string;      // Human-readable amount
  fees: string;                      // Total fees in raw units
  feeCurrency: string;               // Currency symbol (USDC, SOL, etc.)
  feePayer: "sponsor" | "user";     // Who pays bridge fees
  sponsorCost: string;              // Sponsor cost (raw units)
  worstCaseSponsorCostUsd?: number; // Worst-case sponsor cost in USD
  userFee?: string;                  // User fee (raw units)
  userFeeCurrency?: "USDC" | "SOL";  // User fee currency
  userFeeUsd?: number;               // User fee in USD
  gasless?: boolean;                 // true if sponsor pays gas
  requiresSOL?: boolean;             // true if user needs SOL
  userReceivesUsd?: number;          // USD value user receives
  userPaysUsd?: number;              // USD value user pays
  solanaCostToUser?: string;         // SOL cost for Solana origin (lamports)
  solPriceUsd?: number;              // SOL price in USD
  priceDrift?: number;               // Price drift percentage (e.g., 0.02 for 2%)
  operatingExpense?: string;         // Operating expense (deBridge only, raw units)
  expiryAt: number;                  // Timestamp when quote expires (ms)
  raw: unknown;                      // Original provider response
  timeEstimateSeconds?: number;      // Estimated completion time
  slippageTolerance?: string;        // Slippage tolerance
}
```

#### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters (missing fields, invalid route) |
| `NEED_SOL_FOR_GAS` | 400 | User has insufficient SOL for gas fees |
| `QUOTE_ERROR` | 502 | Provider API failure or no routes available |

#### Example Requests

**Example 1: Solana USDC to Base USDC**

```bash
curl -X POST http://localhost:3000/api/quotes \
  -H "Content-Type: application/json" \
  -d '{
    "originChainId": 7565164,
    "destinationChainId": 8453,
    "originToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "destinationToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount": "10000000",
    "userAddress": "9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u",
    "recipientAddress": "0xF0AE622e463fa757Cf72243569E18Be7Df1996cd"
  }'
```

**Example 2: With Balance Optimization**

```bash
curl -X POST http://localhost:3000/api/quotes \
  -H "Content-Type: application/json" \
  -d '{
    "originChainId": 7565164,
    "destinationChainId": 8453,
    "originToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "destinationToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount": "10000000",
    "userAddress": "9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u",
    "recipientAddress": "0xF0AE622e463fa757Cf72243569E18Be7Df1996cd",
    "userSOLBalance": "100000000",
    "userSolanaUSDCBalance": "50000000"
  }'
```

**Example 3: Same-Chain Swap (Solana to Solana)**

```bash
curl -X POST http://localhost:3000/api/quotes \
  -H "Content-Type: application/json" \
  -d '{
    "originChainId": 7565164,
    "destinationChainId": 7565164,
    "originToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "destinationToken": "So11111111111111111111111111111111111111112",
    "amount": "10000000",
    "userAddress": "9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u"
  }'
```

#### Example Responses

**Success Response:**

```json
{
  "success": true,
  "data": {
    "quotes": [
      {
        "provider": "relay",
        "expectedOut": "9950000",
        "expectedOutFormatted": "9.95",
        "fees": "50000",
        "feeCurrency": "USDC",
        "feePayer": "sponsor",
        "sponsorCost": "50000",
        "worstCaseSponsorCostUsd": 0.05,
        "userFee": "60000",
        "userFeeCurrency": "USDC",
        "userFeeUsd": 0.06,
        "gasless": true,
        "requiresSOL": false,
        "userReceivesUsd": 9.95,
        "userPaysUsd": 10.06,
        "expiryAt": 1704067200000,
        "raw": { /* Relay API response */ }
      },
      {
        "provider": "debridge",
        "expectedOut": "9920000",
        "expectedOutFormatted": "9.92",
        "fees": "80000",
        "feeCurrency": "USDC",
        "feePayer": "user",
        "sponsorCost": "0",
        "gasless": false,
        "requiresSOL": true,
        "solanaCostToUser": "15000000",
        "userReceivesUsd": 9.92,
        "userPaysUsd": 10.08,
        "operatingExpense": "20000",
        "expiryAt": 1704067200000,
        "raw": { /* deBridge API response */ }
      }
    ],
    "best": {
      "provider": "relay",
      /* ... same as first quote ... */
    }
  }
}
```

**Validation Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing or invalid: originChainId, destinationChainId, originToken, destinationToken, amount, userAddress"
  }
}
```

**Insufficient SOL Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "NEED_SOL_FOR_GAS",
    "message": "You need SOL to pay for transaction gas. Add ~0.02 SOL to your wallet and try again."
  }
}
```

**No Routes Available Response:**

```json
{
  "success": true,
  "data": {
    "quotes": [],
    "best": null
  }
}
```

## Request Validation

The API validates the following:

1. **Required Fields**: All required fields must be present and non-empty
2. **Chain IDs**: Must be valid chain IDs (see table above)
3. **Token Addresses**: Must be valid addresses for the specified chain
4. **Amount**: Must be a non-zero string representing raw amount
5. **User Address**: Must be a valid Solana address (base58)
6. **Recipient Address**: Required for EVM destinations, must be valid EVM address (0x...)
7. **Route Logic**: Same token on same chain is rejected

## Provider Behavior

### Relay

- **Same-chain swaps**: Only Relay is queried
- **Cross-chain swaps**: Relay is always queried
- **Fee Sponsorship**: Requires Enterprise Partnership for full sponsorship
- **Re-quote on Execution**: Relay quotes are re-fetched before execution for safety

### deBridge

- **Same-chain swaps**: Not queried (Relay only)
- **Cross-chain swaps**: Always queried in parallel with Relay
- **Fee Structure**: User pays all fees (no sponsorship)
- **Operating Expenses**: Explicitly included in quote

## Quote Selection Logic

The API automatically selects the "best" quote based on:

1. **Net USD Value**: `userReceivesUsd - userPaysUsd`
2. **Effective Receive**: Net amount after fees
3. **Tie-Breaker**: Prefer Relay when within 0.1% of deBridge

## Rate Limiting

Currently, there is no rate limiting implemented. Future considerations:

- Per-IP rate limiting
- Per-user rate limiting (if authenticated)
- Provider-specific rate limiting

## Error Handling

The API handles errors gracefully:

- **Provider Failures**: If one provider fails, the other is still queried
- **Network Errors**: Returns `QUOTE_ERROR` with descriptive message
- **Invalid Routes**: Returns `VALIDATION_ERROR` immediately
- **No Routes**: Returns empty quotes array (not an error)

## Best Practices

1. **Use Balance Optimization**: Provide `userSOLBalance` and `userSolanaUSDCBalance` to reduce RPC calls
2. **Handle Empty Quotes**: Check if `best` is `null` before using quote
3. **Check Quote Expiry**: Quotes expire after 15 seconds; re-fetch before execution
4. **Validate Recipient Address**: Always provide `recipientAddress` for EVM destinations
5. **Error Handling**: Always check `success` field before accessing `data`
6. **Chain ID Mapping**: Use internal chain IDs (shown in table above); provider-specific mapping is automatic

---

## Swap History Endpoints

### `GET /api/swaps/history`

Fetches swap transaction history for a user with pagination and filtering options.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userAddress` | `string` | Yes | Solana wallet address (base58) |
| `limit` | `number` | No | Maximum number of swaps to return (default: 50) |
| `offset` | `number` | No | Number of swaps to skip for pagination (default: 0) |
| `status` | `string` | No | Filter by status: `pending`, `confirmed`, `finalized`, `failed`, `completed` |
| `provider` | `string` | No | Filter by provider: `relay` or `debridge` |

#### Response Format

**Success Response** (200 OK):

```typescript
{
  swaps: SwapTransaction[];
  total: number;
  limit: number;
  offset: number;
}
```

**Error Response** (400/500):

```typescript
{
  error: string;
}
```

#### SwapTransaction Type

```typescript
interface SwapTransaction {
  id: string;
  userAddress: string;
  provider: "relay" | "debridge";
  status: "pending" | "confirmed" | "finalized" | "failed" | "completed";
  originChainId: number;
  originToken: string;
  originTokenSymbol: string;
  originTokenAmount: string;
  originTokenAmountFormatted: string;
  destinationChainId: number;
  destinationToken: string;
  destinationTokenSymbol: string;
  destinationTokenAmount: string;
  destinationTokenAmountFormatted: string;
  recipientAddress: string;
  transactionHash: string | null;
  destinationTransactionHash: string | null;
  requestId: string | null; // Relay requestId
  orderId: string | null; // deBridge orderId
  fees: string;
  feeCurrency: string;
  feePayer: "sponsor" | "user";
  sponsorCost: string;
  userFee: string | null;
  userFeeCurrency: string | null;
  userFeeUsd: number | null;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  completedAt: string | null; // ISO date string
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
}
```

#### Example Requests

**Get all swaps for a user:**

```bash
curl "http://localhost:3000/api/swaps/history?userAddress=9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u"
```

**Get pending swaps with pagination:**

```bash
curl "http://localhost:3000/api/swaps/history?userAddress=9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u&status=pending&limit=10&offset=0"
```

**Get Relay swaps only:**

```bash
curl "http://localhost:3000/api/swaps/history?userAddress=9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u&provider=relay"
```

#### Example Response

```json
{
  "swaps": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "userAddress": "9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u",
      "provider": "relay",
      "status": "confirmed",
      "originChainId": 7565164,
      "originToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "originTokenSymbol": "USDC",
      "originTokenAmount": "10000000",
      "originTokenAmountFormatted": "10",
      "destinationChainId": 8453,
      "destinationToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "destinationTokenSymbol": "USDC",
      "destinationTokenAmount": "9950000",
      "destinationTokenAmountFormatted": "9.95",
      "recipientAddress": "0xF0AE622e463fa757Cf72243569E18Be7Df1996cd",
      "transactionHash": "5j7s8K9mN2pQrS4tU6vW7xY8zA1bC3dE5fG6hI7jK8lM9nO0pQ1rS2tU3vW4xY",
      "destinationTransactionHash": "0xabc123def456...",
      "requestId": "req_123456",
      "orderId": null,
      "fees": "50000",
      "feeCurrency": "USDC",
      "feePayer": "sponsor",
      "sponsorCost": "50000",
      "userFee": "60000",
      "userFeeCurrency": "USDC",
      "userFeeUsd": 0.06,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:31:00.000Z",
      "completedAt": null,
      "errorMessage": null,
      "metadata": {
        "quoteExpiryAt": 1704067200000,
        "timeEstimateSeconds": 60
      }
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

### `GET /api/swaps/[id]`

Fetches details for a specific swap transaction by ID.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Swap transaction ID (UUID) |

#### Response Format

**Success Response** (200 OK):

Returns a single `SwapTransaction` object (same format as above).

**Error Response** (404/500):

```typescript
{
  error: string;
}
```

#### Example Request

```bash
curl "http://localhost:3000/api/swaps/123e4567-e89b-12d3-a456-426614174000"
```

#### Example Response

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "userAddress": "9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u",
  "provider": "relay",
  "status": "confirmed",
  // ... same fields as SwapTransaction above
}
```

**Note**: Swap history is currently stored in-memory and will be lost on server restart. Prisma integration is planned for persistent storage.

---

## Testing

You can test the API using:

- **cURL**: See examples above
- **Postman**: Import the examples as a collection
- **JavaScript/TypeScript**: Use `fetch()` or axios

Example TypeScript client:

```typescript
async function getQuotes(params: SwapParams) {
  const response = await fetch('/api/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error.message);
  }
  
  return data.data;
}
```
