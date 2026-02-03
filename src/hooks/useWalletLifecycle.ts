"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

/**
 * Logs wallet connect, disconnect, and account-change events to the console
 * for validation. No UI; keeps page component clean and testable.
 */
export function useWalletLifecycle(): void {
  const { publicKey, connected } = useWallet();
  const prevPublicKeyRef = useRef<string | null>(null);
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    const currentKey = publicKey?.toBase58() ?? null;

    if (connected && publicKey) {
      const keyStr = publicKey.toBase58();
      if (prevPublicKeyRef.current !== keyStr) {
        if (wasConnectedRef.current) {
          console.log("Wallet account changed", { publicKey: keyStr });
        } else {
          console.log("Wallet connected", {
            publicKey: keyStr,
            readyForTx: true,
          });
        }
        prevPublicKeyRef.current = keyStr;
        wasConnectedRef.current = true;
      }
    } else {
      if (wasConnectedRef.current) {
        console.log("Wallet disconnected");
        wasConnectedRef.current = false;
        prevPublicKeyRef.current = null;
      }
    }
  }, [connected, publicKey]);
}
