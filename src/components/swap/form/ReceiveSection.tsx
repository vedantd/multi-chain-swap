"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReceiveDisplay } from "@/lib/swap";
import { DestinationSelector } from "./DestinationSelector";
import type { DropdownOption, TokenOption } from "@/types/swap";
import { swapPanelStyles as styles } from "@/components/swap/styles/SwapPanel.stylex";

export interface ReceiveSectionProps {
  receiveDisplay: ReceiveDisplay | null;
  destinationChainId: number;
  destinationToken: string;
  destinationChainOptions: DropdownOption[];
  destinationTokenOptions: TokenOption[];
  onChangeChain: (chainId: number) => void;
  onChangeToken: (token: string) => void;
  /** When set, show "0.0" (e.g. after successful swap). */
  hideAmount?: boolean;
}

export function ReceiveSection({
  receiveDisplay,
  destinationChainId,
  destinationToken,
  destinationChainOptions,
  destinationTokenOptions,
  onChangeChain,
  onChangeToken,
  hideAmount,
}: ReceiveSectionProps) {
  const receiveValue = hideAmount
    ? "0.0"
    : receiveDisplay?.estimatedOutFormatted
      ? (() => {
          const num = parseFloat(receiveDisplay.estimatedOutFormatted);
          return isNaN(num) ? receiveDisplay.estimatedOutFormatted : num.toFixed(3).replace(/\.?0+$/, "");
        })()
      : "0.0";
  return (
    <div {...stylex.props(styles.toSection)}>
      <div {...stylex.props(styles.toAmountHeaderRow)}>
        <span {...stylex.props(styles.toLabel)}>You receive</span>
      </div>
      <div {...stylex.props(styles.toAmountContent)}>
        <div {...stylex.props(styles.toAmountWrapper)}>
          <input
            type="text"
            inputMode="decimal"
            value={receiveValue}
            readOnly
            placeholder="0.0"
            {...stylex.props(styles.amountInput, styles.amountInputReadOnly)}
            style={{ background: "transparent", backgroundColor: "transparent" }}
          />
        </div>
        <div {...stylex.props(styles.destinationSelectorContainer)}>
          <DestinationSelector
            destinationChainId={destinationChainId}
            destinationToken={destinationToken}
            destinationChainOptions={destinationChainOptions}
            destinationTokenOptions={destinationTokenOptions}
            onChangeChain={onChangeChain}
            onChangeToken={onChangeToken}
          />
        </div>
      </div>
    </div>
  );
}
