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
  originTokenSelect: 'label:has-text("Asset")',
  destinationChainSelect: 'label:has-text("Chain")',
  destinationTokenSelect: 'label:has-text("Token")',
  amountInput: 'input[type="text"][inputmode="decimal"]',
  
  // Form validation
  invalidRouteMessage: 'text=Same token on same chain is not a valid swap',
  evmAddressError: 'text=Could not get EVM address',
  
  // Quote section
  quoteSection: 'text=Loading best quote',
  quoteLoading: 'text=Loading best quote…',
  quoteError: 'text=Failed to load quotes',
  noRoutesMessage: 'text=No routes available',
  quoteTimeoutMessage: 'text=Your quote timed out',
  
  // Quote details
  networkFee: 'text=Network fee',
  relayerFee: 'text=Relayer fee',
  gasSponsored: 'text=Gas sponsored',
  minimumReceived: 'text=Minimum received',
  
  // Quote actions
  refreshQuoteButton: 'button:has-text("Fetch a new one")',
  otherQuoteButton: (text: string) => `button:has-text("${text}")`,
  
  // Execute button
  confirmButton: 'button:has-text("Confirm")',
  confirmingButton: 'button:has-text("Confirming…")',
  
  // Error messages
  insufficientSolMessage: 'text=Need',
  executeSuccess: 'text=Sent. View:',
  executeError: 'text=Failed to send',
  
  // Error banner
  errorBanner: '[role="alert"]',
} as const;
