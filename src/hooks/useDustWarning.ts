"use client";

import { useEffect, useState } from "react";
import type { Connection } from "@solana/web3.js";
import { humanAmountToRaw } from "@/lib/chainConfig";
import { checkDustAndUncloseable } from "@/lib/solana/balance";

export interface DustWarning {
  isDust: boolean;
  isUncloseable: boolean;
  dustAmount: string;
  tokenSymbol: string;
}

export interface UseDustWarningParams {
  connection: Connection | null;
  publicKey: { toBase58(): string } | null;
  originToken: string;
  amount: string;
  userSourceTokenBalance: string | undefined;
  selectedOriginToken: { symbol?: string; decimals?: number } | undefined;
  isSOL: boolean;
}

/**
 * Checks for dust and uncloseable account when amount/balance/origin change.
 */
export function useDustWarning({
  connection,
  publicKey,
  originToken,
  amount,
  userSourceTokenBalance,
  selectedOriginToken,
  isSOL,
}: UseDustWarningParams): DustWarning | null {
  const [dustWarning, setDustWarning] = useState<DustWarning | null>(null);

  useEffect(() => {
    if (!connection || !publicKey || !originToken || !amount || !userSourceTokenBalance) {
      setDustWarning(null);
      return;
    }

    const checkDust = async () => {
      try {
        const rawAmount = humanAmountToRaw(amount, selectedOriginToken?.decimals ?? 9);
        if (!rawAmount || rawAmount === "0") {
          setDustWarning(null);
          return;
        }

        const mint = isSOL ? "SOL" : originToken;
        const result = await checkDustAndUncloseable(
          connection,
          publicKey.toBase58(),
          mint,
          userSourceTokenBalance,
          rawAmount
        );

        if (result.isDust || result.isUncloseable) {
          setDustWarning({
            isDust: result.isDust,
            isUncloseable: result.isUncloseable,
            dustAmount: result.dustAmount,
            tokenSymbol: selectedOriginToken?.symbol ?? "tokens",
          });
        } else {
          setDustWarning(null);
        }
      } catch (error) {
        console.warn("[useDustWarning] Error checking dust:", error);
        setDustWarning(null);
      }
    };

    checkDust();
  }, [
    connection,
    publicKey,
    originToken,
    amount,
    userSourceTokenBalance,
    selectedOriginToken,
    isSOL,
  ]);

  return dustWarning;
}
