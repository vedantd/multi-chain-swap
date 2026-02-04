"use client";

import React, { useCallback, useState, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import type { WalletError } from "@solana/wallet-adapter-base";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";

import { WalletErrorProvider } from "@/contexts/WalletErrorContext";
import { getWalletErrorMessage } from "@/lib/wallet";

import "@solana/wallet-adapter-react-ui/styles.css";

const RPC_ENDPOINT =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    ? process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    : clusterApiUrl(WalletAdapterNetwork.Mainnet);

interface SolanaWalletProviderProps {
  children: ReactNode;
}

/**
 * Use wallets={[]} so only Wallet Standard is used (browser-injected wallets).
 * Explicit adapters (Phantom, Solflare) are redundant and cause duplicate
 * keys (e.g. MetaMask) and "Phantom was registered as Standard Wallet" warnings.
 */
export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onError = useCallback((error: WalletError) => {
    const message = getWalletErrorMessage(error);
    setErrorMessage(message);
    if (typeof console !== "undefined" && console.error) {
      console.error("[Wallet]", error.name, error.message, error);
    }
  }, []);

  const dismissError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={[]} autoConnect={false} onError={onError}>
        <WalletModalProvider>
          <WalletErrorProvider
            errorMessage={errorMessage}
            onDismiss={dismissError}
          >
            {children}
          </WalletErrorProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
