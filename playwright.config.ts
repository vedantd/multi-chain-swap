import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';

/**
 * Playwright configuration for multi-chain swap E2E tests.
 * 
 * Note: Wallet extension setup requires manual configuration.
 * For Phantom wallet, you'll need to:
 * 1. Install Phantom extension in Chrome/Chromium
 * 2. Update the extension path below to point to your Phantom installation
 * 3. Or use a test wallet extension
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Uncomment and configure if you want to use a wallet extension
        // contextOptions: {
        //   // Path to Phantom wallet extension (adjust for your system)
        //   // macOS: ~/Library/Application Support/Google/Chrome/Default/Extensions/bfnaelmomeimhlpmgjnjophhpkkoljpa
        //   // Linux: ~/.config/google-chrome/Default/Extensions/bfnaelmomeimhlpmgjnjophhpkkoljpa
        //   // Windows: C:\Users\<user>\AppData\Local\Google\Chrome\User Data\Default\Extensions\bfnaelmomeimhlpmgjnjophhpkkoljpa
        //   args: [
        //     `--disable-extensions-except=${path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Default/Extensions/bfnaelmomeimhlpmgjnjophhpkkoljpa')}`,
        //     `--load-extension=${path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Default/Extensions/bfnaelmomeimhlpmgjnjophhpkkoljpa')}`,
        //   ],
        // },
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true, // Always reuse existing server if available
    timeout: 120 * 1000,
  },
});
