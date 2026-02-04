/**
 * Centralized selectors for E2E tests
 * These selectors target elements by their text content, labels, or data attributes
 */

export const Selectors = {
  // Header
  headerTitle: 'h1:has-text("Swap")',
  walletButton: '.wallet-adapter-button-trigger',
  
  // Wallet connection
  walletModal: '.wallet-adapter-modal',
  walletOption: (walletName: string) => `button:has-text("${walletName}")`,
  walletAddress: (address: string) => `text=${address}`,
  disconnectButton: 'button:has-text("Disconnect")',
  
  // Wallet status messages
  noWalletMessage: 'text=No Solana wallet detected',
  connectPrompt: 'text=Connect your Solana wallet',
  connectingMessage: 'text=Connecting…',
  walletInfo: (address: string) => `text=Wallet: ${address}`,
  
  // Swap panel
  swapPanel: 'section',
  swapHeading: 'h2:has-text("Swap")',
  
  // Form inputs
  // Note: These selectors may need data-testid attributes added to components
  originTokenSelect: 'input[type="text"][inputmode="decimal"]', // Amount input - will need better selector
  destinationChainSelect: 'button:has-text("Base"), button:has-text("Ethereum"), button:has-text("Solana")', // Chain dropdown
  destinationTokenSelect: 'button:has-text("USDC"), button:has-text("SOL")', // Token dropdown
  amountInput: 'input[type="text"][inputmode="decimal"]',
  
  // Form validation
  invalidRouteMessage: 'text=Same token on same chain is not a valid swap',
  evmAddressError: 'text=Could not get EVM address',
  
  // Quote section
  quoteSection: 'text=Loading best quote',
  quoteLoading: 'text=Loading best quote…',
  quoteError: 'text=/Failed to load quotes|No quotes available/i',
  noRoutesMessage: 'text=/No routes available/i', // Partial match for full message
  quoteTimeoutMessage: 'text=/quote.*timeout|Quote expired/i',
  
  // Quote details
  networkFee: 'text=Network fee',
  relayerFee: 'text=Relayer fee',
  gasSponsored: 'text=Sponsored', // Network fee shows "Sponsored" when gasless
  // minimumReceived: removed - not in current UI
  
  // Quote actions
  refreshQuoteButton: 'button:has-text("Refetch new quote")',
  otherQuoteButton: (text: string) => `button:has-text("${text}")`,
  
  // Execute button
  confirmButton: 'button:has-text("Swap")', // Actual button text
  confirmingButton: 'button:has-text("Swapping…")', // Actual button text when executing
  
  // Error messages
  insufficientSolMessage: 'text=/Insufficient|Add SOL|Need SOL|insufficient funds/i',
  executeSuccess: 'text=/Transaction|Bridge completed|finalized|confirmed/i',
  executeError: 'text=/Failed|Error|refunded/i',
  
  // Route validation errors (new)
  routeValidationError: 'text=/not supported|unsupported route|not found in Relay/i',
  
  // Bridge status (new)
  bridgeStatusPending: 'text=/Bridge in progress|Transaction pending/i',
  bridgeStatusSuccess: 'text=/Bridge completed|Transaction finalized/i',
  bridgeStatusFailed: 'text=/Bridge failed|refunded/i',
  
  // Quote expiry (new)
  quoteExpired: 'text=Quote expired',
  
  // Error banner
  errorBanner: '[role="alert"]',
} as const;
