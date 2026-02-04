"use client";

import * as stylex from "@stylexjs/stylex";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { SkeletonLoader } from "@/components/shared/SkeletonLoader";
import { swapPanelStyles as styles } from "@/components/swap/styles/SwapPanel.stylex";

export interface QuoteFeedbackSectionProps {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  data: { quotes?: unknown[] } | undefined;
  quotes: unknown[];
  params: unknown;
  /** When true, show a short hint that Relay is temporarily unavailable (e.g. only deBridge returned). */
  relayUnavailableHint?: boolean;
}

export function QuoteFeedbackSection({
  isLoading,
  isError,
  error,
  data,
  quotes,
  params,
  relayUnavailableHint,
}: QuoteFeedbackSectionProps) {
  if (isLoading) {
    return (
      <>
        <div {...stylex.props(styles.skeletonSection)}>
          <SkeletonLoader height={16} width="60%" />
          <SkeletonLoader height={16} width="50%" />
          <SkeletonLoader height={16} width="55%" />
        </div>
        <div {...stylex.props(styles.loadingContainer)}>
          <LoadingSpinner size={16} />
          <span {...stylex.props(styles.loadingText)}>Loading best quote…</span>
        </div>
      </>
    );
  }
  if (isError) {
    const err = error as Error & { code?: string };
    const needSolHint = err?.code === "NEED_SOL_FOR_GAS";
    return (
      <div {...stylex.props(styles.errorSection)}>
        <p
          {...stylex.props(
            needSolHint ? styles.errorMessage : styles.errorMessageNoMargin
          )}
        >
          {error?.message ?? "Failed to load quotes"}
        </p>
        {needSolHint && (
          <p {...stylex.props(styles.errorHint)}>
            Get SOL from an exchange or a faucet, send it to your connected wallet, then try again.
          </p>
        )}
      </div>
    );
  }
  if (data && !isLoading && quotes.length === 0) {
    return (
      <p {...stylex.props(styles.noRoutesText)}>
        No routes available for this pair. Try a different amount or token.
      </p>
    );
  }
  if (params != null && !data && !isLoading && !isError) {
    return (
      <div {...stylex.props(styles.loadingContainer)}>
        <LoadingSpinner size={16} />
        <span {...stylex.props(styles.gettingQuoteText)}>Getting your quote…</span>
      </div>
    );
  }
  if (relayUnavailableHint && data && quotes.length > 0) {
    return (
      <p {...stylex.props(styles.noRoutesText)}>
        Relay is temporarily unavailable. Showing other options.
      </p>
    );
  }
  return null;
}
