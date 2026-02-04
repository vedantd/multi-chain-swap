import { test, expect } from '@playwright/test';
import { HomePage } from './helpers/page-objects';

test.describe('Homepage', () => {
  test('should load and display initial state', async ({ page }) => {
    const homePage = new HomePage(page);
    
    await homePage.navigate();
    await homePage.waitForPageLoad();

    // Check header elements
    await expect(homePage.headerTitle).toBeVisible();
    await expect(homePage.headerTitle).toHaveText('Swap');
    await expect(homePage.walletButton).toBeVisible();
  });

  test('should show wallet connection prompt when no wallet is connected', async ({ page }) => {
    const homePage = new HomePage(page);
    
    await homePage.navigate();
    await homePage.waitForPageLoad();

    // Should show either "No Solana wallet detected" or "Connect your Solana wallet"
    const hasNoWalletMessage = await homePage.noWalletMessage.isVisible().catch(() => false);
    const hasConnectPrompt = await homePage.connectPrompt.isVisible().catch(() => false);
    
    expect(hasNoWalletMessage || hasConnectPrompt).toBeTruthy();
  });

  test('should have wallet button that is clickable', async ({ page }) => {
    const homePage = new HomePage(page);
    
    await homePage.navigate();
    await homePage.waitForPageLoad();

    // Wallet button should be visible and clickable
    await expect(homePage.walletButton).toBeVisible();
    await expect(homePage.walletButton).toBeEnabled();
  });

  test('should display correct page structure', async ({ page }) => {
    const homePage = new HomePage(page);
    
    await homePage.navigate();
    await homePage.waitForPageLoad();

    // Check main structure
    await expect(homePage.headerTitle).toBeVisible();
    await expect(homePage.walletButton).toBeVisible();
    
    // Check that main content area exists
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });
});
