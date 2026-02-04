import { Page } from '@playwright/test';

/**
 * Wallet interaction helpers
 * 
 * Note: These helpers assume wallet extensions are installed and configured.
 * For automated testing, you may need to:
 * 1. Use a test wallet with known seed phrase
 * 2. Mock wallet interactions
 * 3. Use Playwright's extension loading capabilities
 */

export class WalletHelper {
  constructor(private page: Page) {}

  /**
   * Click the wallet connect button
   */
  async clickWalletButton() {
    await this.page.locator('.wallet-adapter-button-trigger').click();
  }

  /**
   * Wait for wallet modal to appear
   */
  async waitForWalletModal() {
    await this.page.locator('.wallet-adapter-modal').waitFor({ state: 'visible' });
  }

  /**
   * Select a wallet from the modal (e.g., "Phantom", "Solflare")
   */
  async selectWallet(walletName: string) {
    await this.waitForWalletModal();
    await this.page.locator(`button:has-text("${walletName}")`).click();
  }

  /**
   * Wait for wallet to connect
   * This will wait for the wallet address to appear in the UI
   */
  async waitForConnection(timeout = 30000) {
    // Wait for either wallet info or swap panel to appear
    await Promise.race([
      this.page.waitForSelector('text=/Wallet: [A-Za-z0-9]{4}...[A-Za-z0-9]{4}/', { timeout }),
      this.page.waitForSelector('h2:has-text("Swap")', { timeout }),
    ]);
  }

  /**
   * Get the connected wallet address from the page
   */
  async getConnectedAddress(): Promise<string | null> {
    const walletInfo = this.page.locator('text=/Wallet: ([A-Za-z0-9]{4})...([A-Za-z0-9]{4})/');
    const text = await walletInfo.textContent();
    if (!text) return null;
    
    // Extract address from text like "Wallet: Abc1...Xyz9"
    const match = text.match(/Wallet: ([A-Za-z0-9]{4})...([A-Za-z0-9]{4})/);
    if (!match) return null;
    
    // Note: This only gets partial address. For full address, you'd need to
    // access wallet adapter state or use a different selector
    return match[0];
  }

  /**
   * Disconnect wallet
   */
  async disconnect() {
    await this.clickWalletButton();
    await this.page.locator('button:has-text("Disconnect")').click();
    // Wait for disconnect to complete
    await this.page.waitForSelector('text=Connect your Solana wallet', { timeout: 10000 });
  }

  /**
   * Check if wallet is connected
   */
  async isConnected(): Promise<boolean> {
    const walletInfo = this.page.locator('text=/Wallet: [A-Za-z0-9]{4}...[A-Za-z0-9]{4}/');
    return await walletInfo.isVisible().catch(() => false);
  }

  /**
   * Handle wallet approval dialog (if wallet extension shows one)
   * This is a placeholder - actual implementation depends on wallet extension behavior
   */
  async approveWalletConnection() {
    // This may need to be customized based on the wallet extension's UI
    // Some wallets show browser notifications, others show in-page modals
    // For now, we'll wait a bit and let the wallet handle it
    await this.page.waitForTimeout(2000);
  }
}
