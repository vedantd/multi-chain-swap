# E2E Tests for Multi-Chain Swap

This directory contains end-to-end tests for the multi-chain swap application using Playwright.

## Prerequisites

1. **Node.js 18+** and npm installed
2. **Playwright browsers** installed (run `npx playwright install` after installing dependencies)
3. **Development server** running (`npm run dev`)
4. **Wallet extensions** (Phantom/Solflare) installed in your browser (for wallet connection tests)

## Installation

1. Install dependencies (including Playwright):
   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

## Running Tests

### Basic Commands

- **Run all tests**: `npm run test:e2e`
- **Run tests in UI mode** (interactive): `npm run test:e2e:ui`
- **Run tests in headed mode** (see browser): `npm run test:e2e:headed`
- **Debug tests**: `npm run test:e2e:debug`

### Running Specific Tests

```bash
# Run a specific test file
npx playwright test e2e/homepage.spec.ts

# Run tests matching a pattern
npx playwright test --grep "wallet"

# Run tests in a specific browser
npx playwright test --project=chromium
```

## Test Structure

```
e2e/
├── helpers/
│   ├── selectors.ts      # Centralized CSS selectors
│   ├── page-objects.ts  # Page Object Model classes
│   └── wallet.ts         # Wallet interaction helpers
├── homepage.spec.ts      # Page load and initial state tests
├── wallet-connection.spec.ts  # Wallet connection flow tests
├── swap-form.spec.ts    # Form interaction and validation tests
├── quotes.spec.ts       # Quote fetching and display tests
└── errors.spec.ts       # Error handling scenario tests
```

## Test Coverage

### Homepage Tests (`homepage.spec.ts`)
- Page loads and renders correctly
- Header elements visible
- Initial wallet connection prompt shown
- Wallet button is clickable

### Wallet Connection Tests (`wallet-connection.spec.ts`)
- Wallet button opens selection modal
- Can connect/disconnect wallet
- Wallet address displays when connected
- Swap panel appears after connection
- Connecting state displays correctly

### Swap Form Tests (`swap-form.spec.ts`)
- Token dropdowns populate and work
- Amount input validation (numbers only, decimals)
- Chain selection changes destination tokens
- Invalid route detection (same chain + token)
- Form state updates correctly

### Quote Tests (`quotes.spec.ts`)
- Quote loads after valid form submission
- Quote details display (network fee, relayer fee, minimum received)
- Multiple quote options shown when available
- Quote refresh works
- Quote timeout message appears
- Confirm button appears when quote is available

### Error Tests (`errors.spec.ts`)
- API error messages display
- Insufficient SOL balance warning
- No routes available message
- Invalid form validation errors
- EVM address fetch errors
- Quote timeout handling

## Wallet Extension Setup

The tests are designed to work with real wallet extensions (Phantom, Solflare). For automated testing:

### Option 1: Use Real Wallet Extensions

1. Install Phantom or Solflare browser extension
2. Configure Playwright to load the extension (see `playwright.config.ts`)
3. Tests will interact with the wallet extension UI

### Option 2: Mock Wallet Interactions

For CI/CD or fully automated testing, you may want to:
- Mock wallet adapter responses
- Use a test wallet with known seed phrase
- Stub wallet connection in tests

## Configuration

### Playwright Config (`playwright.config.ts`)

The configuration includes:
- Base URL: `http://localhost:3000`
- Test directory: `e2e/`
- Browser: Chromium (with wallet extension support)
- Auto-start dev server before tests
- Screenshots/videos on failure

### Wallet Extension Path

To use wallet extensions in tests, uncomment and configure the extension path in `playwright.config.ts`:

```typescript
contextOptions: {
  args: [
    `--load-extension=/path/to/wallet/extension`,
  ],
},
```

## Test Data

Tests use real API calls by default. For consistent testing:
- Use test wallets with known balances
- Consider using testnet/mainnet as appropriate
- Some tests may skip if wallet is not available (using `test.skip()`)

## Debugging Tests

### View Test Execution

```bash
# Run with UI mode for visual debugging
npm run test:e2e:ui

# Run in headed mode to see browser
npm run test:e2e:headed

# Run in debug mode with Playwright Inspector
npm run test:e2e:debug
```

### View Test Reports

After running tests, view the HTML report:
```bash
npx playwright show-report
```

### Screenshots and Videos

- Screenshots are saved on test failure
- Videos are saved on test failure (if configured)
- Check `test-results/` directory

## CI/CD Considerations

For CI/CD pipelines:

1. **Install browsers**: `npx playwright install --with-deps`
2. **Run tests**: `npm run test:e2e`
3. **Upload artifacts**: Screenshots/videos in `test-results/`

Note: Wallet extension tests may require special setup in CI environments. Consider:
- Using mocked wallet interactions
- Setting up test wallets
- Using headless browser with extension loading

## Troubleshooting

### Tests fail to connect to dev server

- Ensure `npm run dev` is running on port 3000
- Check `playwright.config.ts` webServer configuration

### Wallet connection tests fail

- Ensure wallet extension is installed
- Configure extension path in `playwright.config.ts`
- Some tests may skip if wallet is not available (this is expected)

### Tests timeout

- Increase timeout in test files if needed
- Check network connectivity for API calls
- Ensure dev server is responsive

### Selectors not found

- Check if UI has changed
- Update selectors in `e2e/helpers/selectors.ts`
- Use Playwright's codegen to generate new selectors: `npx playwright codegen http://localhost:3000`

## Best Practices

1. **Use Page Object Model**: Access elements through `HomePage` class
2. **Centralize Selectors**: Update `selectors.ts` when UI changes
3. **Handle Flaky Tests**: Use appropriate waits and timeouts
4. **Skip When Appropriate**: Use `test.skip()` for tests requiring manual setup
5. **Keep Tests Independent**: Each test should be able to run standalone

## Contributing

When adding new tests:

1. Follow existing test structure
2. Use Page Object Model helpers
3. Add appropriate waits and timeouts
4. Handle cases where wallet/API may not be available
5. Update this README if adding new test categories
