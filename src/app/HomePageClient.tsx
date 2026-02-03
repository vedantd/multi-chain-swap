"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletLifecycle } from "@/hooks/useWalletLifecycle";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { WalletErrorBanner } from "@/components/wallet/WalletErrorBanner";
import { SwapPanel } from "@/components/swap/SwapPanel";

export function HomePageClient() {
  useWalletLifecycle();
  const { publicKey, connected, connecting, wallets } = useWallet();

  const hasWallets = wallets.length > 0;

  return (
    <div style={{ padding: "2rem", maxWidth: "48rem", margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Multi-Chain Swap</h1>
        <WalletConnectButton />
      </header>
      <main>
        <WalletErrorBanner />
        {connecting && (
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--foreground)",
              opacity: 0.8,
              marginBottom: "1rem",
            }}
          >
            Connecting…
          </p>
        )}
        {!hasWallets && !connected && (
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--foreground)",
              opacity: 0.8,
              marginBottom: "1rem",
            }}
          >
            No Solana wallet detected. Install a browser extension like Phantom
            or Solflare to connect.
          </p>
        )}
        <p style={{ color: "var(--foreground)", marginBottom: "1rem" }}>
          Connect your Solana wallet to get started.
        </p>
        {connected && publicKey && !connecting && (
          <>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--foreground)",
                opacity: 0.8,
                marginBottom: "0.5rem",
              }}
            >
              Wallet: {publicKey.toBase58().slice(0, 4)}...
              {publicKey.toBase58().slice(-4)} — ready for transactions
            </p>
            <SwapPanel />
          </>
        )}
      </main>
    </div>
  );
}
