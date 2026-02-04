# Multi-Chain Swap

Bridge-agnostic cross-chain swap UI supporting multiple providers (Relay and deBridge). User pays fees in USDC or SOL; Solana-side costs can be sponsored (requires Enterprise Partnership with Relay).

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Development](#development)
- [Testing](#testing)
- [License](#license)

## Features

- **Multi-Chain Support**: Swap tokens across Solana, Ethereum, Base, Optimism, Arbitrum, BNB Chain, Polygon, and Avalanche
- **Bridge-Agnostic**: Automatically selects the best quote from Relay and deBridge providers
- **Token Support**: SPL tokens and Token-2022 (including transfer fees)
- **Safety Features**: Dust detection, uncloseable account warnings, price drift protection
- **Economic Guarantees**: User pays fees in USDC or SOL; Solana-side costs can be sponsored (requires Enterprise Partnership with Relay)
- **Swap History**: Transaction history tracking with in-memory storage (swap details, tokens, chains, fees, provider, status)
- **Fully Off-Chain**: No Solana programs or smart contracts required

## Tech Stack

- **Next.js** (App Router) + **TypeScript**
- **StyleX** (Meta) for styling
- **Zustand** for state management
- **TanStack Query** for data fetching
- **Solana Wallet Adapter** for wallet connections
- **Playwright** for E2E testing
- **Vitest** for unit testing

## Quick Start

### Prerequisites

- Node.js 18+
- npm (or pnpm / yarn)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd multi-chain-swap
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (optional):
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your configuration. See [Environment Variables Documentation](./docs/ENVIRONMENT_VARIABLES.md) for details.

4. Start the development server:
   ```bash
   npm run dev
   ```

   The application will be available at [http://localhost:3000](http://localhost:3000)

### First Steps

1. **Connect Wallet**: Click the wallet button and connect with Phantom, Solflare, or another Solana wallet
2. **Select Tokens**: Choose origin token (Solana) and destination chain + token
3. **Enter Amount**: Input the amount you want to swap
4. **Get Quote**: The system automatically fetches quotes from Relay and deBridge
5. **Execute Swap**: Review fees and click "Confirm" to execute

## Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

- **[Architecture](./docs/ARCHITECTURE.md)**: System overview, component structure, data flow, and design decisions
- **[API Reference](./docs/API.md)**: Complete API endpoint documentation with request/response formats and examples
  - `POST /api/quotes` - Fetch quotes from Relay and deBridge
  - `GET /api/swaps/history` - Get swap history for a user
  - `GET /api/swaps/[id]` - Get details for a specific swap
- **[Environment Variables](./docs/ENVIRONMENT_VARIABLES.md)**: All environment variables with usage, defaults, and security notes
- **[Deployment Guide](./docs/DEPLOYMENT.md)**: Deployment instructions for Vercel, Docker, and self-hosted options

## Development

### Available Scripts

- **`npm run dev`**: Start development server (default: [http://localhost:3000](http://localhost:3000))
- **`npm run build`**: Create production build
- **`npm run start`**: Run production server (after `npm run build`)
- **`npm run lint`**: Run ESLint

### Project Structure

```
src/
├── app/              # Next.js App Router (pages, API routes)
├── components/       # React components (swap UI, wallet, etc.)
├── hooks/           # Custom React hooks
├── lib/             # Core logic (quote service, providers, utilities)
├── stores/          # Zustand state management
├── types/           # TypeScript type definitions
└── styles/          # StyleX styles
```

See [Architecture Documentation](./docs/ARCHITECTURE.md) for detailed structure.

## Testing

### Unit Tests

Run unit tests with Vitest:

```bash
npm test              # Watch mode
npm run test:run      # Single run
```

### E2E Tests

Run end-to-end tests with Playwright:

```bash
npm run test:e2e           # Run all E2E tests
npm run test:e2e:ui        # Interactive UI mode
npm run test:e2e:headed    # Run with browser visible
npm run test:e2e:debug     # Debug mode
```

**Prerequisites for E2E Tests**:
- Development server running (`npm run dev`)
- Wallet extension installed (Phantom/Solflare) for wallet tests

See [`e2e/README.md`](./e2e/README.md) for more details.

## Environment Variables

All environment variables are optional with sensible defaults. For production, you may want to configure:

- **`NEXT_PUBLIC_SOLANA_RPC_URL`**: Custom Solana RPC endpoint (recommended to avoid 403 errors)
- **`RELAY_DEPOSIT_FEE_PAYER`**: Solana address for fee sponsorship (requires Enterprise Partnership with Relay)

**Note**: In demo mode, users pay their own Solana transaction fees. Full fee sponsorship requires Enterprise Partnership with Relay. Chain ID mapping (Solana uses different IDs for Relay vs deBridge) is handled automatically by the system.

See [Environment Variables Documentation](./docs/ENVIRONMENT_VARIABLES.md) for complete details.

## Deployment

The application can be deployed to:

- **Vercel** (Recommended): Zero-configuration Next.js deployments
- **Docker**: Containerized deployment for any platform
- **Self-Hosted**: Traditional server deployment with PM2

See [Deployment Guide](./docs/DEPLOYMENT.md) for detailed instructions.

## License

Private / unlicensed unless otherwise specified.
