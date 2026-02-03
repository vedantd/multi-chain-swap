"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface WalletErrorContextValue {
  /** User-friendly error message, or null if none. */
  errorMessage: string | null;
  /** Clear the current error. */
  dismiss: () => void;
}

const WalletErrorContext = createContext<WalletErrorContextValue | null>(null);

export function useWalletError(): WalletErrorContextValue {
  const ctx = useContext(WalletErrorContext);
  if (!ctx) {
    return {
      errorMessage: null,
      dismiss: () => {},
    };
  }
  return ctx;
}

interface WalletErrorProviderProps {
  children: ReactNode;
  errorMessage: string | null;
  onDismiss: () => void;
}

export function WalletErrorProvider({
  children,
  errorMessage,
  onDismiss,
}: WalletErrorProviderProps) {
  const dismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const value: WalletErrorContextValue = {
    errorMessage,
    dismiss,
  };

  return (
    <WalletErrorContext.Provider value={value}>
      {children}
    </WalletErrorContext.Provider>
  );
}
