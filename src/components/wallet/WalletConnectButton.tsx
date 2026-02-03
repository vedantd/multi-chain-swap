"use client";

import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

/**
 * Wallet connect/disconnect button using the official adapter UI.
 * Renders only after mount to avoid hydration mismatch (adapter UI differs
 * between server and client).
 * Lifecycle logging (connect, disconnect, account change) is handled by
 * useWalletLifecycle() where this button is rendered.
 */
export function WalletConnectButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="wallet-adapter-button-trigger"
        style={{ marginRight: 0 }}
        disabled
        aria-hidden
      >
        Select Wallet
      </button>
    );
  }

  return (
    <WalletMultiButton
      className="wallet-adapter-button-trigger"
      style={{ marginRight: 0 }}
    />
  );
}
