"use client";

import { useEffect } from "react";
import type { Connection } from "@solana/web3.js";
import { getSolBalance, getTokenBalance } from "@/lib/solana/balance";

export interface UseSwapBalancesParams {
  connection: Connection | null;
  publicKey: { toBase58(): string } | null;
  originToken: string;
  selectedOriginToken: { symbol?: string; decimals?: number } | undefined;
  isSOL: boolean;
  balanceInvalidationCounter: number;
  setUserSOLBalance: (balance: string | undefined) => void;
  setUserSourceTokenBalance: (balance: string | undefined) => void;
}

/**
 * Fetches and keeps SOL + source token balances in sync, and refetches after swap success.
 */
export function useSwapBalances({
  connection,
  publicKey,
  originToken,
  selectedOriginToken,
  isSOL,
  balanceInvalidationCounter,
  setUserSOLBalance,
  setUserSourceTokenBalance,
}: UseSwapBalancesParams): void {
  useEffect(() => {
    if (!connection || !publicKey) {
      setUserSOLBalance(undefined);
      return;
    }
    let cancelled = false;
    getSolBalance(connection, publicKey.toBase58())
      .then((balance) => {
        if (!cancelled) setUserSOLBalance(balance);
      })
      .catch(() => {
        if (!cancelled) setUserSOLBalance(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [connection, publicKey, setUserSOLBalance]);

  useEffect(() => {
    if (!connection || !publicKey || !originToken || !selectedOriginToken) {
      setUserSourceTokenBalance(undefined);
      return;
    }
    let cancelled = false;
    const fetchBalance = async () => {
      try {
        if (isSOL) {
          const balance = await getSolBalance(connection, publicKey.toBase58());
          if (!cancelled) setUserSourceTokenBalance(balance);
        } else {
          const balance = await getTokenBalance(connection, publicKey.toBase58(), originToken);
          if (!cancelled) setUserSourceTokenBalance(balance);
        }
      } catch {
        if (!cancelled) setUserSourceTokenBalance(undefined);
      }
    };
    fetchBalance();
    return () => {
      cancelled = true;
    };
  }, [connection, publicKey, originToken, selectedOriginToken, isSOL, setUserSourceTokenBalance]);

  useEffect(() => {
    if (balanceInvalidationCounter === 0 || !connection || !publicKey) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const addr = publicKey.toBase58();
        const [sol, tokenBal] = await Promise.all([
          getSolBalance(connection, addr),
          originToken && selectedOriginToken
            ? isSOL
              ? getSolBalance(connection, addr)
              : getTokenBalance(connection, addr, originToken)
            : Promise.resolve(undefined),
        ]);
        if (!cancelled) {
          setUserSOLBalance(sol);
          if (tokenBal !== undefined) setUserSourceTokenBalance(tokenBal);
        }
      } catch {
        if (!cancelled) {
          setUserSOLBalance(undefined);
          setUserSourceTokenBalance(undefined);
        }
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    balanceInvalidationCounter,
    connection,
    publicKey,
    originToken,
    selectedOriginToken,
    isSOL,
    setUserSOLBalance,
    setUserSourceTokenBalance,
  ]);
}
