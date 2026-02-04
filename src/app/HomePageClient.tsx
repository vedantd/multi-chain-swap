"use client";

import * as stylex from "@stylexjs/stylex";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWalletLifecycle } from "@/hooks/useWalletLifecycle";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { WalletErrorBanner } from "@/components/wallet/WalletErrorBanner";
import { SwapPanel } from "@/components/swap/SwapPanel";
import { prefetchChains } from "@/lib/relay/routeValidation";
import { typography } from "@/styles/shared.stylex";

const styles = stylex.create({
  pageContainer: {
    padding: "1.5rem 1rem 2rem",
    maxWidth: "36rem",
    margin: "0 auto",
  },
  header: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 1.5rem",
    paddingBottom: "1rem",
    borderBottom: "1px solid var(--border)",
    marginBottom: "0",
  },
  headerTitle: {
    flexShrink: 0,
  },
  headerWallet: {
    marginLeft: "auto",
  },
  // Landing (Nika-style) when wallet not connected
  landingWrap: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "2rem 1.5rem",
  },
  landingGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "3rem",
    alignItems: "center",
    maxWidth: "1100px",
    margin: "0 auto",
    width: "100%",
    "@media (max-width: 768px)": {
      gridTemplateColumns: "1fr",
      gap: "2rem",
    },
  },
  landingCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  headlinePlain: {
    fontSize: "clamp(2rem, 5vw, 3.5rem)",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
    color: "#f4f4f5",
  },
  headlineAccent: {
    fontSize: "clamp(2rem, 5vw, 3.5rem)",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
    color: "#3b82f6",
  },
  bodyCopy: {
    fontSize: "1rem",
    lineHeight: 1.6,
    color: "var(--muted-foreground)",
    maxWidth: "28rem",
  },
  ctaButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "0.5rem",
    width: "fit-content",
  },
  landingVisual: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    "@media (max-width: 768px)": {
      order: -1,
    },
  },
  landingImage: {
    width: "100%",
    maxWidth: "520px",
    height: "auto",
    objectFit: "contain",
  },
  statusText: {
    fontSize: "0.875rem",
    color: "var(--foreground)",
    opacity: 0.8,
    marginBottom: "1rem",
  },
  connectPrompt: {
    color: "var(--foreground)",
    marginBottom: "1rem",
  },
  link: {
    color: "var(--primary)",
    textDecoration: "underline",
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
    cursor: "pointer",
    display: "inline",
  },
});

export function HomePageClient() {
  useWalletLifecycle();
  const { publicKey, connected, connecting, wallets } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    prefetchChains().catch((err) => {
      console.warn("[HomePageClient] Failed to prefetch chains:", err);
    });
  }, []);

  const hasWallets = wallets.length > 0;
  const showLanding = mounted && !connected;

  return (
    <>
      {showLanding ? (
        <div {...stylex.props(styles.landingWrap)}>
          <div {...stylex.props(styles.landingGrid)}>
            <div {...stylex.props(styles.landingCopy)}>
              <h1 {...stylex.props(styles.headlinePlain)}>DeFi your way.</h1>
              <h1 {...stylex.props(styles.headlineAccent)}>Your Nika.</h1>
              <p {...stylex.props(styles.bodyCopy)}>
                Multi-chain swap from Solana to Ethereum, Base, Arbitrum, Polygon,
                and more. Connect your wallet to swap USDC and other tokens across
                chains in one app.
              </p>
              <div className="landing-cta-wrap" {...stylex.props(styles.ctaButton)}>
                <WalletMultiButton className="wallet-adapter-button-trigger">
                  Connect Wallet
                </WalletMultiButton>
              </div>
            </div>
            <div {...stylex.props(styles.landingVisual)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/nika.avif"
                alt="Nika app on phone and laptop"
                {...stylex.props(styles.landingImage)}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <header {...stylex.props(styles.header)}>
            <h1 {...stylex.props(typography.h1, styles.headerTitle)}>Cross-chain swaps</h1>
            <div {...stylex.props(styles.headerWallet)}>
              <WalletConnectButton />
            </div>
          </header>
          <div {...stylex.props(styles.pageContainer)}>
          <main>
            <WalletErrorBanner />
            {mounted && (
              <>
                {connecting && (
                  <p {...stylex.props(styles.statusText)}>Connecting…</p>
                )}
                {!hasWallets && !connected && (
                  <p {...stylex.props(styles.statusText)}>
                    No Solana wallet detected. Install a browser extension like{" "}
                    <a
                      href="https://phantom.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      {...stylex.props(styles.link)}
                      style={{ textDecoration: "underline" }}
                    >
                      Phantom
                    </a>{" "}
                    or{" "}
                    <a
                      href="https://solflare.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      {...stylex.props(styles.link)}
                      style={{ textDecoration: "underline" }}
                    >
                      Solflare
                    </a>{" "}
                    to connect.
                  </p>
                )}
                {hasWallets && !connected && !connecting && (
                  <p {...stylex.props(styles.connectPrompt)}>
                    Connect your Solana wallet to get started.
                  </p>
                )}
                {connected && publicKey && !connecting && <SwapPanel />}
              </>
            )}
          </main>
          </div>
        </>
      )}
    </>
  );
}
