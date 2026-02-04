# Environment Variables Documentation

## Overview

All environment variables in this project are **optional** and have sensible defaults. The application will work without any configuration, but you may want to customize certain settings for production use.

## Required Variables

**None** - All variables are optional with defaults.

## Optional Variables

### Solana RPC Configuration

#### `NEXT_PUBLIC_SOLANA_RPC_URL`

- **Type**: `string` (URL)
- **Default**: Public Solana RPC (`https://api.mainnet-beta.solana.com`)
- **Required**: No
- **Client-Exposed**: Yes (prefixed with `NEXT_PUBLIC_`)
- **Used In**: `src/components/providers/SolanaWalletProvider.tsx`

**Description**:  
Custom Solana RPC endpoint for wallet connections and blockchain queries. The default public RPC may return 403 errors under high load, so using a dedicated RPC provider (Alchemy, QuickNode, etc.) is recommended for production.

**Example**:
```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
```

**Security Note**:  
This variable is exposed to the client browser. Do not include sensitive API keys unless you're using a public RPC endpoint. For private endpoints, ensure your API key has appropriate rate limits and access controls.

---

### Bridge Provider API Configuration

#### `RELAY_API_URL`

- **Type**: `string` (URL)
- **Default**: `https://api.relay.link`
- **Required**: No
- **Client-Exposed**: No (server-only)
- **Used In**: 
  - `src/lib/relay/quote.ts`
  - `src/lib/tokens/supportedTokens.ts`

**Description**:  
Base URL for the Relay API. Only change this if you're using a custom Relay endpoint or testing environment.

**Example**:
```bash
RELAY_API_URL=https://api.relay.link
```

---

#### `DEBRIDGE_API_URL`

- **Type**: `string` (URL)
- **Default**: `https://api.dln.trade`
- **Required**: No
- **Client-Exposed**: No (server-only)
- **Used In**: `src/lib/debridge/quote.ts`

**Description**:  
Base URL for the deBridge DLN API. Only change this if you're using a custom deBridge endpoint or testing environment.

**Example**:
```bash
DEBRIDGE_API_URL=https://api.dln.trade
```

---

### Fee Sponsorship Configuration

#### `RELAY_DEPOSIT_FEE_PAYER`

- **Type**: `string` (Solana address, base58)
- **Default**: `Av29j1oEbWAt77AzXyTA2fAzRnHytfG3mEV8kYm5E83M` (from `DEFAULT_DEPOSIT_FEE_PAYER` constant)
- **Required**: No
- **Client-Exposed**: No (server-only)
- **Used In**: `src/lib/relay/quote.ts`

**Description**:  
Solana address that pays transaction fees and rent for deposit transactions when using Relay. This address must have sufficient SOL to cover transaction costs.

**Fallback Order**:
1. `params.depositFeePayer` (from API request)
2. `RELAY_DEPOSIT_FEE_PAYER` (this variable)
3. `SPONSOR_SOLANA_ADDRESS` (alias)
4. `DEFAULT_DEPOSIT_FEE_PAYER` (hardcoded constant)

**Important Notes**:
- **Enterprise Partnership Required**: Full fee sponsorship (covering destination chain fees via `subsidizeFees` and `subsidizeRent`) requires Enterprise Partnership with Relay
- **Demo Mode**: In the current demo implementation, users pay their own Solana transaction fees. The `depositFeePayer` parameter defaults to the user's address. Once Enterprise Partnership is obtained, set this variable to the sponsor address to enable fee sponsorship.
- **Security**: This address will pay for all Solana origin transactions. Ensure it has appropriate funding and monitoring

**Example**:
```bash
RELAY_DEPOSIT_FEE_PAYER=YourSolanaAddressHere111111111111111111111111111
```

---

#### `SPONSOR_SOLANA_ADDRESS`

- **Type**: `string` (Solana address, base58)
- **Default**: Same as `RELAY_DEPOSIT_FEE_PAYER` fallback
- **Required**: No
- **Client-Exposed**: No (server-only)
- **Used In**: `src/lib/relay/quote.ts`

**Description**:  
Alias for `RELAY_DEPOSIT_FEE_PAYER`. Both variables serve the same purpose and use the same fallback chain. Use whichever naming convention you prefer.

**Example**:
```bash
SPONSOR_SOLANA_ADDRESS=YourSolanaAddressHere111111111111111111111111111
```

---

### Logging Configuration

#### `QUOTE_ACCOUNTING_LOG_PATH`

- **Type**: `string` (file path)
- **Default**: `./logs/quotes.jsonl`
- **Required**: No
- **Client-Exposed**: No (server-only)
- **Used In**: `src/lib/swap/logging/quoteLogger.ts`

**Description**:  
File path where quote evaluation logs are written. Logs are written in JSONL format (one JSON object per line) for analytics and debugging purposes.

**Example**:
```bash
QUOTE_ACCOUNTING_LOG_PATH=./logs/quotes.jsonl
```

**Note**:  
Ensure the directory exists and the application has write permissions. The log file is created automatically if it doesn't exist.

---

### Application Configuration

#### `NEXT_PUBLIC_APP_NAME`

- **Type**: `string`
- **Default**: Not set
- **Required**: No
- **Client-Exposed**: Yes (prefixed with `NEXT_PUBLIC_`)
- **Used In**: Currently unused (reserved for future use)

**Description**:  
Application name for branding or display purposes. Currently not used but reserved for future features.

**Example**:
```bash
NEXT_PUBLIC_APP_NAME=multi-chain-swap
```

---

## Environment-Specific Setup

### Development

Create a `.env.local` file in the project root:

```bash
# Copy the example file
cp .env.example .env.local

# Edit with your values
nano .env.local
```

**Important**:  
- `.env.local` is gitignored and will not be committed
- Variables are loaded automatically by Next.js
- Restart the dev server after changing variables

### Production

#### Vercel

1. Go to your project settings in Vercel dashboard
2. Navigate to "Environment Variables"
3. Add each variable with appropriate values
4. Select environment (Production, Preview, Development)
5. Redeploy for changes to take effect

#### Docker

Use `--env-file` flag:

```bash
docker run -p 3000:3000 --env-file .env.production multi-chain-swap
```

Or set variables directly:

```bash
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY \
  -e RELAY_DEPOSIT_FEE_PAYER=YourAddress \
  multi-chain-swap
```

#### Self-Hosted

Set variables in your process manager (PM2, systemd, etc.):

**PM2** (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'multi-chain-swap',
    script: 'npm',
    args: 'start',
    env: {
      NEXT_PUBLIC_SOLANA_RPC_URL: 'https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY',
      RELAY_DEPOSIT_FEE_PAYER: 'YourAddress',
    }
  }]
};
```

**systemd** (`.service` file):
```ini
[Service]
Environment="NEXT_PUBLIC_SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY"
Environment="RELAY_DEPOSIT_FEE_PAYER=YourAddress"
```

---

## Security Best Practices

### Client-Exposed Variables (`NEXT_PUBLIC_*`)

⚠️ **Warning**: Variables prefixed with `NEXT_PUBLIC_` are exposed to the client browser.

**Do**:
- Use for public configuration (RPC URLs, app names)
- Use public RPC endpoints or endpoints with rate-limited API keys
- Assume these values are visible to anyone inspecting your application

**Don't**:
- Include sensitive API keys without proper access controls
- Include private keys or secrets
- Include internal service URLs or credentials

### Server-Only Variables

✅ **Safe**: Variables without `NEXT_PUBLIC_` prefix are server-only.

**Safe to use for**:
- Private API endpoints
- Internal service URLs
- Sensitive configuration
- Database credentials (if added later)

### General Security Guidelines

1. **Never commit `.env.local` or `.env` files** - They're gitignored for a reason
2. **Use different values for development and production** - Don't share production keys
3. **Rotate keys regularly** - Especially for RPC providers and API keys
4. **Monitor usage** - Set up alerts for unexpected API usage
5. **Use environment-specific files** - `.env.development`, `.env.production`, etc.

---

## Variable Reference Table

| Variable | Type | Default | Client-Exposed | Required |
|----------|------|---------|----------------|----------|
| `NEXT_PUBLIC_SOLANA_RPC_URL` | URL | Public Solana RPC | ✅ Yes | No |
| `RELAY_API_URL` | URL | `https://api.relay.link` | ❌ No | No |
| `DEBRIDGE_API_URL` | URL | `https://api.dln.trade` | ❌ No | No |
| `RELAY_DEPOSIT_FEE_PAYER` | Address | `DEFAULT_DEPOSIT_FEE_PAYER` | ❌ No | No |
| `SPONSOR_SOLANA_ADDRESS` | Address | Same as above | ❌ No | No |
| `QUOTE_ACCOUNTING_LOG_PATH` | Path | `./logs/quotes.jsonl` | ❌ No | No |
| `NEXT_PUBLIC_APP_NAME` | String | Not set | ✅ Yes | No |

---

## Troubleshooting

### Variables Not Loading

1. **Check file name**: Must be `.env.local` (development) or `.env.production` (production)
2. **Restart server**: Next.js only loads env vars on startup
3. **Check syntax**: No spaces around `=` sign
4. **Check prefix**: `NEXT_PUBLIC_*` for client variables

### Client Variables Not Available

- Ensure variable is prefixed with `NEXT_PUBLIC_`
- Restart dev server after adding new variables
- Check browser console for undefined values

### Server Variables Not Available

- Ensure variable does NOT have `NEXT_PUBLIC_` prefix
- Check server logs (not browser console)
- Verify variable is set in production environment

### RPC Errors (403, Rate Limited)

- Set `NEXT_PUBLIC_SOLANA_RPC_URL` to a dedicated provider (Alchemy, QuickNode)
- Check API key is valid and has sufficient quota
- Consider using multiple RPC endpoints with failover

---

## Example Configuration Files

### `.env.local` (Development)

```bash
# Solana RPC (use Alchemy or QuickNode to avoid 403 errors)
NEXT_PUBLIC_SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# Bridge Provider APIs (optional, defaults work fine)
RELAY_API_URL=https://api.relay.link
DEBRIDGE_API_URL=https://api.dln.trade

# Fee Sponsorship (optional, defaults to user paying)
# RELAY_DEPOSIT_FEE_PAYER=YourSolanaAddressHere

# Logging (optional)
QUOTE_ACCOUNTING_LOG_PATH=./logs/quotes.jsonl
```

### `.env.production` (Production)

```bash
# Production RPC endpoint
NEXT_PUBLIC_SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/PRODUCTION_KEY

# Production fee payer (if Enterprise Partnership obtained)
RELAY_DEPOSIT_FEE_PAYER=ProductionSponsorAddress

# Production logging
QUOTE_ACCOUNTING_LOG_PATH=/var/log/multi-chain-swap/quotes.jsonl
```
