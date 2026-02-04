"use client";

import * as stylex from "@stylexjs/stylex";
import { swapPanelStyles as styles } from "@/components/swap/styles/SwapPanel.stylex";

export interface ExecutionResultCardsProps {
  executeSuccess: string | null;
  executeError: string | null;
  onDismissSuccess: () => void;
  onDismissError: () => void;
}

export function ExecutionResultCards({
  executeSuccess,
  executeError,
  onDismissSuccess,
  onDismissError,
}: ExecutionResultCardsProps) {
  const successNode = executeSuccess ? (() => {
    const urlMatch = executeSuccess.match(/https:\/\/[^\s]+/);
    const explorerUrl = urlMatch?.[0] ?? null;
    const textOnly = explorerUrl
      ? executeSuccess.replace(/\s*View:\s*https:\/\/[^\s]+/, "").trim()
      : executeSuccess;
    return (
      <div
        {...stylex.props(styles.resultCard, styles.resultCardSuccess)}
        className="fade-in-animation"
      >
        <div {...stylex.props(styles.resultCardHeader)}>
          <span {...stylex.props(styles.statusIcon)}>✓</span>
          Swap completed
        </div>
        {textOnly && textOnly.length > 25 && (
          <div {...stylex.props(styles.resultCardBody, styles.resultCardBodySuccess)}>
            {textOnly}
          </div>
        )}
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            {...stylex.props(styles.resultCardExplorerButton)}
          >
            View on Explorer
          </a>
        )}
        <button
          type="button"
          aria-label="Dismiss"
          {...stylex.props(styles.dismissMessageButton)}
          onClick={onDismissSuccess}
        >
          ×
        </button>
      </div>
    );
  })() : null;

  const errorNode = executeError ? (
    <div
      {...stylex.props(styles.resultCard, styles.resultCardError)}
      className="fade-in-animation"
    >
      <div {...stylex.props(styles.resultCardHeader)}>
        <span {...stylex.props(styles.statusIcon)}>✗</span>
        Swap failed
      </div>
      <div {...stylex.props(styles.resultCardBody)}>{executeError}</div>
      <button
        type="button"
        aria-label="Dismiss"
        {...stylex.props(styles.dismissMessageButton)}
        onClick={onDismissError}
      >
        ×
      </button>
    </div>
  ) : null;

  if (!successNode && !errorNode) return null;
  return (
    <>
      {successNode}
      {errorNode}
    </>
  );
}
