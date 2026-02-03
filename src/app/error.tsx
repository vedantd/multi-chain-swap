"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof console !== "undefined" && console.error) {
      console.error("[App Error]", error);
    }
  }, [error]);

  return (
    <div
      style={{
        padding: "2rem",
        maxWidth: "32rem",
        margin: "2rem auto",
        textAlign: "center",
      }}
    >
      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
        Something went wrong
      </h2>
      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--foreground)",
          opacity: 0.8,
          marginBottom: "1rem",
        }}
      >
        An unexpected error occurred. You can try again or refresh the page.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          padding: "0.5rem 1rem",
          fontSize: "0.875rem",
          fontWeight: 500,
          border: "1px solid var(--foreground)",
          borderRadius: "6px",
          background: "transparent",
          color: "var(--foreground)",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
