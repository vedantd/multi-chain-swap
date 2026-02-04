"use client";

import * as stylex from "@stylexjs/stylex";
import { formatRawAmount } from "@/lib/chainConfig";
import type { DustWarning } from "@/hooks/useDustWarning";
import { swapPanelStyles as styles } from "@/components/swap/styles/SwapPanel.stylex";

export interface SwapWarningsProps {
  dustWarning: DustWarning | null;
  evmAddressError: string | null;
  destIsEvm: boolean;
}

export function SwapWarnings({ dustWarning, evmAddressError, destIsEvm }: SwapWarningsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap, 0.5rem)" }}>
      {dustWarning && (dustWarning.isDust || dustWarning.isUncloseable) && (
        <div {...stylex.props(styles.warningBanner)} className="fade-in-animation">
          <span {...stylex.props(styles.warningIcon)} aria-hidden>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <div>
            {dustWarning.isDust && (
              <div>
                <strong>Warning:</strong> This swap will leave{" "}
                {formatRawAmount(dustWarning.dustAmount, dustWarning.tokenSymbol)} {dustWarning.tokenSymbol} that
                cannot be recovered (dust amount below rent-exempt minimum).
              </div>
            )}
            {dustWarning.isUncloseable && (
              <div>
                <strong>Warning:</strong> This swap will leave your account balance exactly at the rent-exempt
                minimum, making it uncloseable without losing the rent deposit.
              </div>
            )}
          </div>
        </div>
      )}
      {destIsEvm && evmAddressError && (
        <p {...stylex.props(styles.errorText)}>
          {evmAddressError.includes("MetaMask") || evmAddressError.includes("Phantom") ? (
            <>
              {evmAddressError
                .split(/(MetaMask|Phantom)/)
                .filter(Boolean)
                .map((part, i) => {
                  if (part === "MetaMask") {
                    return (
                      <a
                        key={i}
                        href="https://metamask.io/"
                        target="_blank"
                        rel="noopener noreferrer"
                        {...stylex.props(styles.errorLink)}
                        style={{ textDecoration: "underline" }}
                      >
                        MetaMask
                      </a>
                    );
                  }
                  if (part === "Phantom") {
                    return (
                      <a
                        key={i}
                        href="https://phantom.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        {...stylex.props(styles.errorLink)}
                        style={{ textDecoration: "underline" }}
                      >
                        Phantom
                      </a>
                    );
                  }
                  return <span key={i}>{part}</span>;
                })}
            </>
          ) : (
            evmAddressError
          )}
        </p>
      )}
    </div>
  );
}
