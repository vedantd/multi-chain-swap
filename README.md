# Multi-Chain Swap

Bridge-agnostic cross-chain swap UI supporting multiple providers (Relay, deBridge). User pays fees in USDC or SOL; Solana-side costs are sponsored.

## Tech stack

- **Next.js** (App Router) + **TypeScript**
- **StyleX** (Meta) for styling

## Prerequisites

- Node.js 18+
- npm (or pnpm / yarn)

## Setup

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables (optional for now):

   ```bash
   cp .env.example .env.local
   ```

   Environment variables will be used later for RPC endpoints and provider API keys.

## Scripts

- **Development:** `npm run dev` — start the dev server (default: [http://localhost:3000](http://localhost:3000))
- **Build:** `npm run build` — production build
- **Start:** `npm run start` — run the production server (after `npm run build`)
- **Lint:** `npm run lint` — run ESLint

## Roadmap

- Relay and deBridge integration will be added in follow-up work.
- Unified swap interface and wallet connection are planned.

## License

Private / unlicensed unless otherwise specified.
