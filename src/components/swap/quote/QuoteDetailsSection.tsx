"use client";

import * as stylex from "@stylexjs/stylex";
import type { NormalizedQuote } from "@/types/swap";
import {
  getNetworkFeeDisplay,
  getServiceFeeDisplay,
  type QuotePrices,
} from "@/lib/swap";
import { swapPanelStyles as styles } from "@/components/swap/styles/SwapPanel.stylex";
import { buttons } from "@/styles/shared.stylex";

export interface QuoteDetailsSectionProps {
  /** Quote to display (selected or best). When null, placeholders are shown. */
  quote: NormalizedQuote | null;
  /** Price map for USD display. */
  prices: QuotePrices;
  /** Whether the quote has expired. */
  isQuoteExpired: boolean;
  /** Whether a swap is currently executing. */
  executing: boolean;
  /** Whether quotes are being fetched. */
  isFetching: boolean;
  /** Refetch handler (clears selection and fetches new quote). */
  onRefetch: () => Promise<void>;
}

export function QuoteDetailsSection({
  quote,
  prices,
  isQuoteExpired,
  executing,
  isFetching,
  onRefetch,
}: QuoteDetailsSectionProps) {
  if (!quote) {
    return (
      <div {...stylex.props(styles.itemizedSection)}>
        <div {...stylex.props(styles.itemizedRow)}>
          <span {...stylex.props(styles.itemizedLabel)}>Network fee</span>
          <span {...stylex.props(styles.itemizedValue)}>—</span>
        </div>
        <div {...stylex.props(styles.itemizedRow)}>
          <span {...stylex.props(styles.itemizedLabel)}>Service fee</span>
          <span {...stylex.props(styles.itemizedValue)}>—</span>
        </div>
      </div>
    );
  }

  const networkFeeDisplay = getNetworkFeeDisplay(quote, prices);
  const { text: serviceFeeDisplay, isFree: isServiceFeeFree } = getServiceFeeDisplay(quote, prices);

  return (
    <>
      <div {...stylex.props(styles.itemizedSection)}>
        <div {...stylex.props(styles.itemizedRow)}>
          <span {...stylex.props(styles.itemizedLabel)}>Network fee</span>
          <span {...stylex.props(styles.itemizedValue)}>{networkFeeDisplay}</span>
        </div>
        <div {...stylex.props(styles.itemizedRow)}>
          <span {...stylex.props(styles.itemizedLabel)}>Service fee</span>
          <span
            {...stylex.props(
              isServiceFeeFree
                ? styles.itemizedValueGreen
                : styles.itemizedValueRed
            )}
          >
            {serviceFeeDisplay}
          </span>
        </div>
        {quote.priceDrift != null && quote.priceDrift > 0 && (
          <div {...stylex.props(styles.itemizedRow)}>
            <span {...stylex.props(styles.itemizedLabel)}>Price drift</span>
            <span {...stylex.props(styles.itemizedValue)}>
              {(quote.priceDrift * 100).toFixed(1)}%
            </span>
          </div>
        )}
        <div {...stylex.props(styles.poweredByRow)}>
          <span {...stylex.props(styles.poweredByLabel)}>Powered by</span>
          <div {...stylex.props(styles.poweredByLogoWrap)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                quote.provider === "debridge"
                  ? "/debridge.png"
                  : quote.provider === "jupiter"
                    ? "/jupiter.png"
                    : "/relay.png"
              }
              alt=""
              aria-hidden
              {...stylex.props(styles.poweredByLogo)}
            />
          </div>
        </div>
      </div>
      {!executing && isQuoteExpired && (
        <div {...stylex.props(styles.timeoutMessage)}>
          <span>Quote expired.</span>
          <button
            type="button"
            onClick={onRefetch}
            disabled={isFetching}
            {...stylex.props(buttons.textLink, isFetching && buttons.textLinkDisabled)}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              boxShadow: "none",
            }}
          >
            Refetch new quote?
          </button>
        </div>
      )}
    </>
  );
}
