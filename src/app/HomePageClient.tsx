"use client";

import * as stylex from '@stylexjs/stylex';
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletLifecycle } from "@/hooks/useWalletLifecycle";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { WalletErrorBanner } from "@/components/wallet/WalletErrorBanner";
import { SwapPanel } from "@/components/swap/SwapPanel";
import { layout, typography, spacing } from '@/styles/shared.stylex';

const styles = stylex.create({
  pageContainer: {
    padding: '1.5rem 1rem 2rem',
    maxWidth: '28rem',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid var(--border)',
  },
  statusText: {
    fontSize: '0.875rem',
    color: 'var(--foreground)',
    opacity: 0.8,
    marginBottom: '1rem',
  },
  connectPrompt: {
    color: 'var(--foreground)',
    marginBottom: '1rem',
  },
  walletInfo: {
    fontSize: '0.875rem',
    color: 'var(--foreground)',
    opacity: 0.8,
    marginBottom: '0.5rem',
  },
});

export function HomePageClient() {
  useWalletLifecycle();
  const { publicKey, connected, connecting, wallets } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hasWallets = wallets.length > 0;

  return (
    <div {...stylex.props(styles.pageContainer)}>
      <header {...stylex.props(styles.header)}>
        <h1 {...stylex.props(typography.h1)}>Swap</h1>
        <WalletConnectButton />
      </header>
      <main>
        <WalletErrorBanner />
        {mounted && (
          <>
            {connecting && (
              <p {...stylex.props(styles.statusText)}>
                Connecting…
              </p>
            )}
            {!hasWallets && !connected && (
              <p {...stylex.props(styles.statusText)}>
                No Solana wallet detected. Install a browser extension like Phantom
                or Solflare to connect.
              </p>
            )}
            {hasWallets && !connected && !connecting && (
              <p {...stylex.props(styles.connectPrompt)}>
                Connect your Solana wallet to get started.
              </p>
            )}
            {connected && publicKey && !connecting && (
              <SwapPanel />
            )}
          </>
        )}
      </main>
    </div>
  );
}
