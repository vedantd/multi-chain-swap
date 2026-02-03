"use client";

import { useWalletError } from "@/contexts/WalletErrorContext";

/**
 * Dismissible banner that shows the latest wallet error.
 * Uses aria-live so screen readers announce when the message appears.
 */
export function WalletErrorBanner() {
  const { errorMessage, dismiss } = useWalletError();

  if (!errorMessage) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        padding: "0.75rem 1rem",
        marginBottom: "1rem",
        backgroundColor: "rgba(220, 38, 38, 0.1)",
        border: "1px solid rgba(220, 38, 38, 0.3)",
        borderRadius: "6px",
        color: "var(--foreground)",
        fontSize: "0.875rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
      }}
    >
      <span>{errorMessage}</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss error"
        style={{
          padding: "0.25rem 0.5rem",
          border: "none",
          borderRadius: "4px",
          background: "rgba(0,0,0,0.1)",
          cursor: "pointer",
          fontSize: "0.875rem",
          color: "inherit",
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
