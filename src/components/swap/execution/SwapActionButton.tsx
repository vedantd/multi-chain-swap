"use client";

import * as stylex from "@stylexjs/stylex";
import type { NormalizedQuote } from "@/types/swap";
import type { TransactionStatus } from "@/lib/solana/transactionStatus";
import { swapPanelStyles as styles } from "@/components/swap/styles/SwapPanel.stylex";

export interface SwapActionButtonProps {
  rawAmount: string;
  isLoading: boolean;
  insufficientSourceToken: boolean;
  canExecute: boolean;
  best: NormalizedQuote | null;
  executing: boolean;
  transactionStatus: TransactionStatus | null;
  onExecute: () => void;
}

export function SwapActionButton({
  rawAmount,
  isLoading,
  insufficientSourceToken,
  canExecute,
  best,
  executing,
  transactionStatus,
  onExecute,
}: SwapActionButtonProps) {
  if (rawAmount === "0" || !rawAmount || isLoading) {
    return null;
  }
  if (insufficientSourceToken) {
    return (
      <button
        type="button"
        disabled
        {...stylex.props(styles.insufficientFundsButton)}
      >
        Insufficient funds
      </button>
    );
  }
  if (canExecute && best) {
    const label = executing
      ? transactionStatus === "pending"
        ? "Swapping…"
        : transactionStatus === "confirmed" || transactionStatus === "finalized"
          ? "Swapped"
          : "Swapping…"
      : "Swap";
    return (
      <button
        type="button"
        onClick={onExecute}
        disabled={executing}
        {...stylex.props(styles.swapButton, executing && styles.swapButtonDisabled)}
      >
        {label}
      </button>
    );
  }
  return null;
}
