import { Page, Locator } from '@playwright/test';
import { Selectors } from './selectors';

/**
 * Page Object Model for common page elements and interactions
 */
export class HomePage {
  constructor(private page: Page) {}

  // Header elements
  get headerTitle(): Locator {
    return this.page.locator(Selectors.headerTitle);
  }

  get walletButton(): Locator {
    return this.page.locator(Selectors.walletButton);
  }

  // Wallet connection elements
  get walletModal(): Locator {
    return this.page.locator(Selectors.walletModal);
  }

  walletOption(walletName: string): Locator {
    return this.page.locator(Selectors.walletOption(walletName));
  }

  get connectPrompt(): Locator {
    return this.page.locator(Selectors.connectPrompt);
  }

  get noWalletMessage(): Locator {
    return this.page.locator(Selectors.noWalletMessage);
  }

  get connectingMessage(): Locator {
    return this.page.locator(Selectors.connectingMessage);
  }

  walletInfo(address: string): Locator {
    return this.page.locator(Selectors.walletInfo(address));
  }

  // Swap panel elements
  get swapPanel(): Locator {
    return this.page.locator(Selectors.swapPanel);
  }

  get swapHeading(): Locator {
    return this.page.locator(Selectors.swapHeading);
  }

  // Form elements
  get originTokenSelect(): Locator {
    return this.page.locator(Selectors.originTokenSelect);
  }

  get destinationChainSelect(): Locator {
    return this.page.locator(Selectors.destinationChainSelect);
  }

  get destinationTokenSelect(): Locator {
    return this.page.locator(Selectors.destinationTokenSelect);
  }

  get amountInput(): Locator {
    return this.page.locator(Selectors.amountInput);
  }

  // Quote elements
  get quoteLoading(): Locator {
    return this.page.locator(Selectors.quoteLoading);
  }

  get quoteError(): Locator {
    return this.page.locator(Selectors.quoteError);
  }

  get noRoutesMessage(): Locator {
    return this.page.locator(Selectors.noRoutesMessage);
  }

  get networkFee(): Locator {
    return this.page.locator(Selectors.networkFee);
  }

  get relayerFee(): Locator {
    return this.page.locator(Selectors.relayerFee);
  }

  get minimumReceived(): Locator {
    return this.page.locator(Selectors.minimumReceived);
  }

  // Action buttons
  get confirmButton(): Locator {
    return this.page.locator(Selectors.confirmButton);
  }

  get refreshQuoteButton(): Locator {
    return this.page.locator(Selectors.refreshQuoteButton);
  }

  // Error elements
  get invalidRouteMessage(): Locator {
    return this.page.locator(Selectors.invalidRouteMessage);
  }

  get evmAddressError(): Locator {
    return this.page.locator(Selectors.evmAddressError);
  }

  get insufficientSolMessage(): Locator {
    return this.page.locator(Selectors.insufficientSolMessage);
  }

  // Helper methods
  async navigate() {
    await this.page.goto('/');
  }

  async waitForPageLoad() {
    await this.headerTitle.waitFor({ state: 'visible' });
  }

  async fillSwapForm(options: {
    originToken?: string;
    amount?: string;
    destinationChain?: string;
    destinationToken?: string;
  }) {
    if (options.originToken) {
      await this.originTokenSelect.click();
      await this.page.locator(`text=${options.originToken}`).click();
    }

    if (options.amount) {
      await this.amountInput.fill(options.amount);
    }

    if (options.destinationChain) {
      await this.destinationChainSelect.click();
      await this.page.locator(`text=${options.destinationChain}`).click();
    }

    if (options.destinationToken) {
      await this.destinationTokenSelect.click();
      await this.page.locator(`text=${options.destinationToken}`).click();
    }
  }

  async waitForQuote(timeout = 30000) {
    // Wait for quote to load (either success or error)
    await Promise.race([
      this.page.waitForSelector(Selectors.networkFee, { timeout }),
      this.page.waitForSelector(Selectors.quoteError, { timeout }),
      this.page.waitForSelector(Selectors.noRoutesMessage, { timeout }),
    ]);
  }
}
