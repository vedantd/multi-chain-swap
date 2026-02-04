"use client";

import * as stylex from "@stylexjs/stylex";
import type { NormalizedQuote } from "@/types/swap";
import type { TransactionStatus } from "@/lib/solana/transactionStatus";
import { getExplorerUrlForSignature } from "@/lib/utils/explorerUrl";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { swapPanelStyles as styles } from "@/components/swap/styles/SwapPanel.stylex";

export interface TransactionStatusBannerProps {
  transactionStatus: TransactionStatus | null;
  transactionSignature: string | null;
  executeSuccess: string | null;
  activeQuote: NormalizedQuote | null;
}

export function TransactionStatusBanner({
  transactionStatus,
  transactionSignature,
  executeSuccess,
  activeQuote,
}: TransactionStatusBannerProps) {
  if (!transactionStatus || !transactionSignature || executeSuccess) {
    return null;
  }
  const explorerHref = getExplorerUrlForSignature(
    transactionSignature,
    activeQuote?.provider === "debridge" ? "evm" : "solana"
  );
  return (
    <div
      {...stylex.props(
        styles.transactionStatusBanner,
        transactionStatus === "pending" && styles.transactionStatusPending,
        transactionStatus === "confirmed" && styles.transactionStatusConfirmed,
        transactionStatus === "finalized" && styles.transactionStatusFinalized,
        transactionStatus === "failed" && styles.transactionStatusFailed
      )}
      className="fade-in-animation"
    >
      <div {...stylex.props(styles.transactionStatusRow)}>
        <div {...stylex.props(styles.statusIcon)}>
          {transactionStatus === "pending" && <LoadingSpinner size={16} />}
          {transactionStatus === "confirmed" && "✓"}
          {transactionStatus === "finalized" && "✓"}
          {transactionStatus === "failed" && "✗"}
        </div>
        <span style={{ fontWeight: 500 }}>
          Transaction{" "}
          {transactionStatus === "pending" && "pending"}
          {transactionStatus === "confirmed" && "confirmed"}
          {transactionStatus === "finalized" && "finalized"}
          {transactionStatus === "failed" && "failed"}
        </span>
      </div>
      {transactionStatus !== "failed" && (
        <a
          href={explorerHref}
          target="_blank"
          rel="noopener noreferrer"
          {...stylex.props(styles.transactionLink)}
        >
          View on Explorer
        </a>
      )}
    </div>
  );
}
