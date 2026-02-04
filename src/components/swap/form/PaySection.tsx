"use client";

import * as stylex from "@stylexjs/stylex";
import { formatRawAmount } from "@/lib/chainConfig";
import { TokenSelect } from "./TokenSelect";
import type { TokenOption } from "@/types/swap";
import { swapPanelStyles as styles } from "@/components/swap/styles/SwapPanel.stylex";

export interface PaySectionProps {
  amount: string;
  onAmountChange: (value: string) => void;
  originToken: string;
  setOriginToken: (token: string) => void;
  originTokenOptions: TokenOption[];
  chainBadgeUrl: string | undefined;
  userSourceTokenBalance: string | undefined;
  selectedOriginToken: { symbol?: string } | undefined;
}

export function PaySection({
  amount,
  onAmountChange,
  originToken,
  setOriginToken,
  originTokenOptions,
  chainBadgeUrl,
  userSourceTokenBalance,
  selectedOriginToken,
}: PaySectionProps) {
  return (
    <div {...stylex.props(styles.inputSection)}>
      <div {...stylex.props(styles.inputHeaderRow)}>
        <span {...stylex.props(styles.inputLabel)}>You pay</span>
      </div>
      <div {...stylex.props(styles.inputRow)}>
        <div {...stylex.props(styles.inputAmountWrapper)}>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d*\.?\d*$/.test(v)) onAmountChange(v);
            }}
            placeholder="0.0"
            {...stylex.props(styles.amountInput)}
            style={{ background: "transparent", backgroundColor: "transparent" }}
          />
          {userSourceTokenBalance !== undefined && (
            <div {...stylex.props(styles.balanceText)}>
              Balance: {formatRawAmount(String(userSourceTokenBalance), selectedOriginToken?.symbol ?? "")}{" "}
              {selectedOriginToken?.symbol ?? ""}
            </div>
          )}
        </div>
        <div {...stylex.props(styles.tokenSelectContainer)}>
          <TokenSelect
            options={originTokenOptions}
            value={originToken}
            onChange={setOriginToken}
            placeholder="Select token"
            chainBadgeUrl={chainBadgeUrl}
          />
        </div>
      </div>
    </div>
  );
}
