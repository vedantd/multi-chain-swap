"use client";

import type { ReactNode } from "react";
import { SolanaWalletProvider } from "./SolanaWalletProvider";

interface ClientProvidersProps {
  children: ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return <SolanaWalletProvider>{children}</SolanaWalletProvider>;
}
