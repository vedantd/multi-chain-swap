/**
 * Layout and section styles for SwapPanel.
 */

import * as stylex from "@stylexjs/stylex";

export const swapPanelLayoutStyles = stylex.create({
  panelContainer: {
    marginTop: "1.5rem",
  },
  section: {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "1.5rem",
    background: "var(--background)",
    marginBottom: "1rem",
  },
  heading: {
    fontSize: "1.125rem",
    fontWeight: 600,
    marginBottom: "0.5rem",
  },
  description: {
    fontSize: "0.8125rem",
    color: "var(--muted-foreground)",
    marginBottom: "1.25rem",
  },
  arrowContainer: {
    display: "flex",
    justifyContent: "center",
    margin: "0.25rem 0",
  },
  arrowIcon: {
    width: "1.5rem",
    height: "1.5rem",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--muted-foreground)",
  },
});
