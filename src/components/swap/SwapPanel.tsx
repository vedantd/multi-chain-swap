/**
 * SwapPanel Component
 * 
 * Main UI component for the multi-chain swap interface. Handles:
 * - Token and chain selection (Solana origin, multiple EVM/Solana destinations)
 * - Quote fetching and display (Relay and deBridge providers)
 * - Balance checking and insufficient funds validation
 * - Transaction execution (Solana for Relay, EVM for deBridge)
 * - Price fetching for USD value display
 * - Quote staleness detection and refresh prompts
 * 
 * This component orchestrates the entire swap flow from user input to transaction execution.
 */

"use client";

// External dependencies
import * as stylex from '@stylexjs/stylex';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";

// Internal types
import type { DropdownOption, NormalizedQuote, SwapParams, TokenOption } from "@/types/swap";

// Internal utilities/lib functions
import {
  CHAIN_ID_SOLANA,
  DESTINATION_CHAIN_IDS,
  formatRawAmount,
  getChainName,
  humanAmountToRaw,
  isEvmChain,
  TOKENS_BY_CHAIN,
} from "@/lib/chainConfig";
import {
  QUOTE_DEBOUNCE_MS,
  QUOTE_STALE_MS,
  QUOTE_VALIDITY_MS,
  USDC_MINT_SOLANA,
} from "@/lib/constants";
import { getDebridgeQuote } from "@/lib/debridge/quote";
import { getSolPriceInUsdc, getTokenPriceUsd } from "@/lib/pricing";
import {
  effectiveReceiveRaw,
  hasEnoughSolForQuote,
  minSolRequiredForQuote,
  validateSponsorProfitability,
} from "@/lib/swap/quoteService";
import { getSolBalance, getTokenBalance, checkDustAndUncloseable } from "@/lib/solana/balance";
import { pollTransactionStatus, type TransactionStatus } from "@/lib/solana/transactionStatus";
import { pollRelayBridgeStatus, mapRelayStatusToSwapStatus } from "@/lib/relay/bridgeStatus";
import { getUserFriendlyErrorMessage, withRetry } from "@/lib/wallet/errors";

// Internal components
import { SelectDropdown } from "@/components/swap/SelectDropdown";
import { TokenSelect } from "@/components/swap/TokenSelect";
import { DestinationSelector } from "@/components/swap/DestinationSelector";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { SkeletonLoader } from "@/components/shared/SkeletonLoader";

// Internal hooks
import { useQuotes } from "@/hooks/useQuotes";
import { useSupportedTokens } from "@/hooks/useSupportedTokens";

// Store
import {
  useSwapStore,
  computeSwapParams,
  computeRecipientAddress,
  computeEvmAddressValid,
} from "@/stores/swapStore";

// Swap history
import {
  createSwapRecordFromQuote,
  updateSwapStatus,
} from "@/lib/swap/history";

// Styles
import { container, typography, buttons, form, quote, badge, layout } from '@/styles/shared.stylex';

const ORIGIN_CHAIN_ID = CHAIN_ID_SOLANA;

function computeReceiveDisplay(q: NormalizedQuote) {
  const effectiveReceive = effectiveReceiveRaw(q);
  const expectedOutNum = BigInt(q.expectedOut);
  const expectedOutFormattedNum = parseFloat(q.expectedOutFormatted);
  const useRatio =
    expectedOutNum > BigInt(0) &&
    Number.isFinite(expectedOutFormattedNum) &&
    expectedOutFormattedNum >= 0;

  const effectiveReceiveFormatted = useRatio
    ? (() => {
        const ratio = Number(effectiveReceive) / Number(expectedOutNum);
        const value = ratio * expectedOutFormattedNum;
        if (!Number.isFinite(value) || value < 0) return "0";
        if (value >= 1e9) {
          return String(Math.round(value));
        }
        const formatted = value.toFixed(3);
        return formatted.replace(/\.?0+$/, "");
      })()
    : formatRawAmount(String(effectiveReceive), q.feeCurrency);

  return {
    effectiveReceive,
    effectiveReceiveFormatted,
    estimatedOutFormatted: q.expectedOutFormatted,
    symbol: q.feeCurrency,
  };
}

const styles = stylex.create({
  panelContainer: {
    marginTop: '1.5rem',
  },
  section: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.5rem',
    background: 'var(--background)',
    marginBottom: '1rem',
  },
  heading: {
    fontSize: '1.125rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  description: {
    fontSize: '0.8125rem',
    color: 'var(--muted-foreground)',
    marginBottom: '1.25rem',
  },
  inputSection: {
    padding: '1rem',
    borderRadius: '16px',
    border: 'none',
    background: 'transparent',
    marginBottom: '0.75rem',
  },
  inputHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  inputLabel: {
    fontSize: '0.75rem',
    color: 'var(--muted-foreground)',
    fontWeight: 500,
    width: '80px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    lineHeight: '1.5',
  },
  chainBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
    background: 'var(--muted)',
    color: 'var(--muted-foreground)',
  },
  solanaIcon: {
    display: 'block',
  },
  inputRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
    paddingLeft: '0.75rem',
    paddingRight: '0',
  },
  inputAmountWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    background: 'transparent',
    minWidth: 0,
  },
  inputHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '0.5rem',
    paddingLeft: '0.75rem',
    paddingRight: '0',
  },
  tokenSelectContainer: {
    flexShrink: 0,
    minWidth: '170px',
    width: '170px',
    minHeight: '2.5rem',
    display: 'flex',
    alignItems: 'center',
  },
  inputGroup: {
    width: '100%',
  },
  inputGroupWide: {
    width: '100%',
  },
  balanceText: {
    fontSize: '0.75rem',
    color: 'var(--muted-foreground)',
    marginTop: '0.25rem',
    paddingLeft: '0',
  },
  amountInput: {
    width: '100%',
    padding: '0',
    margin: '0',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'transparent',
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
    fontSize: '2rem',
    fontWeight: 500,
    boxSizing: 'border-box',
    outline: 'none',
    lineHeight: 1.2,
    WebkitAppearance: 'none',
    MozAppearance: 'textfield',
    appearance: 'none',
  },
  rawAmountHint: {
    fontSize: '0.7rem',
    color: 'var(--muted-foreground)',
    marginTop: '0.35rem',
  },
  arrowContainer: {
    display: 'flex',
    justifyContent: 'center',
    margin: '0.25rem 0',
  },
  arrowIcon: {
    width: '1.5rem',
    height: '1.5rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--muted-foreground)',
  },
  warningIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: '1.25rem',
    height: '1.25rem',
    color: 'var(--destructive)',
  },
  toSection: {
    padding: '1rem',
    borderRadius: '16px',
    border: 'none',
    background: 'transparent',
    marginBottom: '0.75rem',
  },
  toHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  toLabel: {
    fontSize: '0.75rem',
    color: 'var(--muted-foreground)',
    fontWeight: 500,
    width: '80px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    lineHeight: '1.5',
  },
  toAmountRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '0.25rem',
  },
  toAmountHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '0.5rem',
    paddingLeft: '0.75rem',
    paddingRight: '0',
  },
  toAmountContent: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
    paddingLeft: '0.75rem',
    paddingRight: '0',
  },
  toAmountWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    background: 'transparent',
    minWidth: 0,
  },
  destinationSelectorContainer: {
    flexShrink: 0,
    minWidth: '170px',
    width: '170px',
    minHeight: '2.5rem',
    display: 'flex',
    alignItems: 'center',
  },
  receiveAmount: {
    fontSize: '2rem',
    fontWeight: 500,
    color: 'var(--foreground)',
    lineHeight: 1.2,
  },
  receiveAmountPlaceholder: {
    fontSize: '2rem',
    fontWeight: 500,
    color: 'var(--muted-foreground)',
    lineHeight: 1.2,
  },
  receiveCaption: {
    fontSize: '0.75rem',
    color: 'var(--muted-foreground)',
    marginTop: '0.15rem',
  },
  toInputRow: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-start',
    marginTop: '0.5rem',
    flexWrap: 'wrap',
  },
  errorText: {
    fontSize: '0.75rem',
    color: 'var(--destructive)',
    marginBottom: '0.25rem',
  },
  warningBanner: {
    fontSize: '0.875rem',
    color: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '8px',
    padding: '0.75rem',
    marginBottom: '0.75rem',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    transition: 'all 0.3s ease',
  },
  errorLink: {
    color: 'var(--primary)',
    textDecoration: 'underline',
    textDecorationThickness: '1px',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
    display: 'inline',
  },
  invalidRouteText: {
    fontSize: '0.75rem',
    color: 'var(--muted-foreground, #666)',
    marginBottom: '0.5rem',
  },
  expiryIndicator: {
    fontSize: '0.75rem',
    marginTop: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  expiryIndicatorWarning: {
    color: '#f59e0b',
  },
  expiryIndicatorExpired: {
    color: 'var(--destructive)',
  },
  expiryIndicatorNormal: {
    color: 'var(--muted-foreground, #666)',
  },
  quoteSection: {
    marginTop: '1.5rem',
    paddingTop: '1.25rem',
    borderTop: '1px solid var(--border)',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: 'var(--muted-foreground, #666)',
    padding: '0.75rem 0',
  },
  loadingText: {
    fontSize: '0.875rem',
    color: 'var(--muted-foreground, #666)',
  },
  errorSection: {
    fontSize: '0.875rem',
  },
  errorMessage: {
    color: 'var(--destructive)',
    marginBottom: '0.5rem',
  },
  errorMessageNoMargin: {
    color: 'var(--destructive)',
    marginBottom: 0,
  },
  errorHint: {
    color: 'var(--muted-foreground, #666)',
    marginTop: 0,
  },
  noRoutesText: {
    fontSize: '0.875rem',
    color: 'var(--muted-foreground, #666)',
    marginBottom: '0',
    minHeight: '1.5rem',
  },
  timeoutMessage: {
    fontSize: '0.875rem',
    color: 'var(--muted-foreground, #666)',
    marginTop: '0.75rem',
    marginBottom: '0.75rem',
    textAlign: 'right',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '0.25rem',
  },
  quoteDetails: {
    marginBottom: '1rem',
  },
  skeletonSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  itemizedSection: {
    fontSize: '0.875rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  itemizedRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  itemizedLabel: {
    color: 'var(--muted-foreground, #666)',
  },
  itemizedValue: {
    color: 'var(--foreground)',
  },
  itemizedValueRed: {
    color: 'var(--destructive, #ef4444)',
  },
  itemizedValueBold: {
    fontWeight: 600,
  },
  itemizedMarginTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    marginTop: '0.25rem',
  },
  otherOptions: {
    fontSize: '0.75rem',
    color: 'var(--muted-foreground, #666)',
    marginTop: '0.35rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  infoIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '0.875rem',
    height: '0.875rem',
    borderRadius: '50%',
    border: '1px solid var(--muted-foreground)',
    color: 'var(--muted-foreground)',
    fontSize: '0.625rem',
    fontWeight: 600,
    cursor: 'help',
    flexShrink: 0,
  },
  infoTooltip: {
    position: 'relative',
    display: 'inline-block',
  },
  actionRow: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: '1rem',
    minHeight: '3rem',
  },
  insufficientSolText: {
    fontSize: '0.8rem',
    color: 'var(--destructive, #b91c1c)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  insufficientFundsButton: {
    padding: '1rem 1.5rem',
    borderRadius: '16px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'not-allowed',
    opacity: 0.5,
    width: '100%',
    textAlign: 'center',
    background: 'rgba(255, 255, 255, 0.05)',
    border: 'none',
    color: 'var(--muted-foreground)',
    transition: 'all 0.2s ease',
  },
  refreshButton: {
    textDecoration: 'underline',
    background: 'none',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    padding: 0,
    fontSize: 'inherit',
  },
  swapButton: {
    padding: '1rem 1.5rem',
    borderRadius: '16px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    color: '#ffffff',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
    ':hover:not(:disabled)': {
      transform: 'translateY(-2px)',
      boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
      background: 'linear-gradient(135deg, #7c8ef0 0%, #8a5fb8 100%)',
    },
    ':active:not(:disabled)': {
      transform: 'translateY(0)',
      boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
    },
  },
  swapButtonDisabled: {
    cursor: 'not-allowed',
    opacity: 0.5,
    background: 'rgba(255, 255, 255, 0.05)',
    boxShadow: 'none',
  },
  successMessage: {
    fontSize: '0.875rem',
    color: 'var(--success, #22c55e)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    marginBottom: '1rem',
    transition: 'all 0.3s ease',
    marginTop: '0.5rem',
  },
  transactionStatusBanner: {
    fontSize: '0.875rem',
    padding: '0.75rem',
    borderRadius: '8px',
    marginTop: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'all 0.3s ease',
  },
  transactionStatusPending: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    color: '#60a5fa',
  },
  transactionStatusConfirmed: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    color: '#4ade80',
  },
  transactionStatusFinalized: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    border: '1px solid rgba(34, 197, 94, 0.4)',
    color: '#22c55e',
  },
  transactionStatusFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
  },
  transactionLink: {
    color: 'inherit',
    textDecoration: 'underline',
    textDecorationThickness: '1px',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
  },
  executeErrorMessage: {
    fontSize: '0.875rem',
    color: 'var(--destructive, #ef4444)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    marginBottom: '1rem',
    transition: 'all 0.3s ease',
  },
  statusIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1.25rem',
    height: '1.25rem',
    borderRadius: '50%',
    fontSize: '0.75rem',
    fontWeight: 600,
    flexShrink: 0,
  },
  gettingQuoteText: {
    fontSize: '0.875rem',
    color: 'var(--muted-foreground, #666)',
  },
});

export function SwapPanel() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, wallet } = useWallet();

  // Zustand store state and actions
  const originToken = useSwapStore((state) => state.originToken);
  const amount = useSwapStore((state) => state.amount);
  const destinationChainId = useSwapStore((state) => state.destinationChainId);
  const destinationToken = useSwapStore((state) => state.destinationToken);
  const destinationAddressOverride = useSwapStore((state) => state.destinationAddressOverride);
  const evmAddressFetching = useSwapStore((state) => state.evmAddressFetching);
  const evmAddressError = useSwapStore((state) => state.evmAddressError);
  const evmDefaultWalletHintDismissed = useSwapStore((state) => state.evmDefaultWalletHintDismissed);
  const userSOLBalance = useSwapStore((state) => state.userSOLBalance);
  const userSourceTokenBalance = useSwapStore((state) => state.userSourceTokenBalance);
  const params = useSwapStore((state) => state.params);
  const selectedQuote = useSwapStore((state) => state.selectedQuote);
  const executing = useSwapStore((state) => state.executing);
  const executeError = useSwapStore((state) => state.executeError);
  const executeSuccess = useSwapStore((state) => state.executeSuccess);
  const paramsLastChangedAt = useSwapStore((state) => state.paramsLastChangedAt);
  const prices = useSwapStore((state) => state.prices);
  const now = useSwapStore((state) => state.now);

  // Store actions
  const setOriginToken = useSwapStore((state) => state.setOriginToken);
  const setAmount = useSwapStore((state) => state.setAmount);
  const setDestinationChainId = useSwapStore((state) => state.setDestinationChainId);
  const setDestinationToken = useSwapStore((state) => state.setDestinationToken);
  const setDestinationAddressOverride = useSwapStore((state) => state.setDestinationAddressOverride);
  const setEvmAddressFetching = useSwapStore((state) => state.setEvmAddressFetching);
  const setEvmAddressError = useSwapStore((state) => state.setEvmAddressError);
  const setEvmDefaultWalletHintDismissed = useSwapStore((state) => state.setEvmDefaultWalletHintDismissed);
  const setUserSOLBalance = useSwapStore((state) => state.setUserSOLBalance);
  const setUserSourceTokenBalance = useSwapStore((state) => state.setUserSourceTokenBalance);
  const setParams = useSwapStore((state) => state.setParams);
  const setSelectedQuote = useSwapStore((state) => state.setSelectedQuote);
  const setExecuting = useSwapStore((state) => state.setExecuting);
  const setExecuteError = useSwapStore((state) => state.setExecuteError);
  const setExecuteSuccess = useSwapStore((state) => state.setExecuteSuccess);
  const setParamsLastChangedAt = useSwapStore((state) => state.setParamsLastChangedAt);
  const setPrices = useSwapStore((state) => state.setPrices);
  const updateNow = useSwapStore((state) => state.updateNow);
  const clearBalances = useSwapStore((state) => state.clearBalances);
  const resetForm = useSwapStore((state) => state.resetForm);
  const clearQuoteState = useSwapStore((state) => state.clearQuoteState);
  const clearExecutionState = useSwapStore((state) => state.clearExecutionState);

  const fetchingRef = useRef(false);
  /** After clearing destination due to wallet change, skip the "fetch when empty" effect so only the wallet-change refetch runs (with correct wallet). */
  const walletChangeClearedAtRef = useRef<number | null>(null);
  
  const fetchEvmAddress = useCallback(async () => {
    if (typeof window === "undefined") return;

    if (fetchingRef.current) {
      return;
    }
    fetchingRef.current = true;
    setEvmAddressFetching(true);
    setEvmAddressError(null);

    const rawWalletName = wallet?.adapter?.name ?? "(none)";
    const connectedWalletName = (wallet?.adapter?.name ?? "").toLowerCase();
    const win = window as unknown as {
      ethereum?: {
        request: (args: { method: string }) => Promise<unknown>;
        isMetaMask?: boolean;
        isPhantom?: boolean;
        providers?: Array<{ request: (args: { method: string }) => Promise<unknown>; isMetaMask?: boolean; isPhantom?: boolean }>;
      };
      phantom?: { ethereum?: { request: (args: { method: string }) => Promise<unknown>; isPhantom?: boolean } };
    };
    const hasPhantomEthereum = !!win.phantom?.ethereum;
    const hasStandardEthereum = !!win.ethereum;
    const standardIsPhantom = !!(win.ethereum as { isPhantom?: boolean } | undefined)?.isPhantom;
    const standardIsMetaMask = !!(win.ethereum as { isMetaMask?: boolean } | undefined)?.isMetaMask;
    const providersArray = (win.ethereum as { providers?: unknown[] } | undefined)?.providers;
    const hasProvidersArray = Array.isArray(providersArray) && providersArray.length > 0;
    const metamaskFromProviders = hasProvidersArray
      ? (providersArray as Array<{ isMetaMask?: boolean; request?: (args: { method: string }) => Promise<unknown> }>).find((p) => p?.isMetaMask && !(p as { isPhantom?: boolean }).isPhantom)
      : undefined;
    const phantomFromProviders = hasProvidersArray
      ? (providersArray as Array<{ isPhantom?: boolean; request?: (args: { method: string }) => Promise<unknown> }>).find((p) => (p as { isPhantom?: boolean }).isPhantom)
      : undefined;

    // Use only the provider that matches the connected Solana wallet.
    // When both Phantom and MetaMask are installed, window.ethereum is often overwritten (e.g. by Phantom).
    // Use window.phantom.ethereum for Phantom; for MetaMask try window.ethereum.providers (EIP-5740) or window.ethereum.
    type EthereumProvider = { request: (args: { method: string }) => Promise<unknown> };
    let ethereum: EthereumProvider | undefined;
    let providerSource: string;

    if (connectedWalletName.includes("phantom") && hasPhantomEthereum) {
      ethereum = win.phantom!.ethereum!;
      providerSource = "phantom.ethereum (Solana wallet is Phantom)";
    } else if (connectedWalletName.includes("metamask") && (hasStandardEthereum || metamaskFromProviders)) {
      if (standardIsPhantom && metamaskFromProviders?.request) {
        ethereum = metamaskFromProviders as EthereumProvider;
        providerSource = "window.ethereum.providers[MetaMask] (window.ethereum was Phantom)";
      } else if (!standardIsPhantom && hasStandardEthereum) {
        ethereum = win.ethereum!;
        providerSource = "window.ethereum (Solana wallet is MetaMask)";
      } else if (metamaskFromProviders?.request) {
        ethereum = metamaskFromProviders as EthereumProvider;
        providerSource = "window.ethereum.providers[MetaMask]";
      } else {
        ethereum = win.ethereum!;
        providerSource = "window.ethereum (fallback; may be Phantom if overwritten)";
        if (standardIsPhantom) console.warn("[EVM] Solana is MetaMask but window.ethereum is Phantom and no providers[]; will get Phantom address");
      }
    } else if (hasStandardEthereum) {
      ethereum = win.ethereum!;
      providerSource = `window.ethereum (fallback; connectedWalletName="${connectedWalletName}")`;
    } else if (hasPhantomEthereum) {
      ethereum = win.phantom!.ethereum!;
      providerSource = "phantom.ethereum (fallback)";
    } else {
      providerSource = "(none)";
    }

    const timeoutId = setTimeout(() => {
      console.warn("[EVM] fetchEvmAddress timed out");
      setEvmAddressError("Request timed out. Please try again or enter address manually.");
      fetchingRef.current = false;
      setEvmAddressFetching(false);
    }, 10000);

    try {
      if (!ethereum?.request) {
        clearTimeout(timeoutId);
        console.error("[EVM] no provider request method");
        setEvmAddressError("No Ethereum provider found. Install MetaMask or enable EVM in Phantom.");
        fetchingRef.current = false;
        setEvmAddressFetching(false);
        return;
      }

      const requested = await Promise.race([
        ethereum.request({ method: "eth_requestAccounts" }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("eth_requestAccounts timeout")), 10000)
        ),
      ]);
      clearTimeout(timeoutId);
      const finalAccounts: string[] = Array.isArray(requested)
        ? requested.filter((a): a is string => typeof a === "string")
        : [];
      const first = finalAccounts[0];

      const phantomSameAsWindow = win.phantom?.ethereum === win.ethereum;

      if (typeof first === "string" && first.startsWith("0x") && first.length === 42) {
        setDestinationAddressOverride(first);
        setEvmAddressError(null);
      } else if (finalAccounts.length === 0) {
        setEvmAddressError("No accounts found. Connect your EVM wallet or enter address manually.");
      } else {
        setEvmAddressError("Invalid address from wallet.");
        console.warn("[EVM] invalid first account", first);
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const msg = err instanceof Error ? err.message : "Failed to fetch EVM address";
      console.error("[EVM] fetchEvmAddress error", { error: msg, providerSource });
      if (!/reject|denied|User rejected/i.test(msg)) {
        setEvmAddressError(`Failed to connect: ${msg}`);
      }
    } finally {
      fetchingRef.current = false;
      setEvmAddressFetching(false);
    }
  }, [wallet?.adapter?.name, setEvmAddressFetching, setEvmAddressError, setDestinationAddressOverride]);

  const { tokens: originTokensFetched } = useSupportedTokens(ORIGIN_CHAIN_ID);
  const { tokens: destinationTokensFetched } = useSupportedTokens(destinationChainId, {
    enabled: !!originToken,
  });

  // Preload tokens for all destination chains in the background
  const [preloadedTokens, setPreloadedTokens] = useState<Record<number, typeof destinationTokensFetched>>({});
  
  // Dust detection state
  const [dustWarning, setDustWarning] = useState<{
    isDust: boolean;
    isUncloseable: boolean;
    dustAmount: string;
    tokenSymbol: string;
  } | null>(null);
  
  // Transaction tracking state
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus | null>(null);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  
  // Quote expiry timer state
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
  // Fetch tokens for all chains in the background
  useEffect(() => {
    const fetchAllTokens = async () => {
      const { getSupportedTokensForChain } = await import("@/lib/tokens/supportedTokens");
      const promises = DESTINATION_CHAIN_IDS.map(async (chainId) => {
        try {
          const tokens = await getSupportedTokensForChain(chainId);
          return { chainId, tokens };
        } catch (error) {
          console.warn(`[SwapPanel] Failed to preload tokens for chain ${chainId}:`, error);
          return { chainId, tokens: TOKENS_BY_CHAIN[chainId] ?? [] };
        }
      });
      const results = await Promise.allSettled(promises);
      const tokensMap: Record<number, typeof destinationTokensFetched> = {};
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          tokensMap[result.value.chainId] = result.value.tokens;
        }
      });
      setPreloadedTokens((prev) => ({ ...prev, ...tokensMap }));
    };
    fetchAllTokens();
  }, []);

  const originFallback = TOKENS_BY_CHAIN[ORIGIN_CHAIN_ID] ?? [];
  const destinationFallback = TOKENS_BY_CHAIN[destinationChainId] ?? [];

  const originTokens = useMemo(
    () =>
      originTokensFetched.length > 0 ? originTokensFetched : originFallback,
    [originTokensFetched, originFallback]
  );
  
  // Use preloaded tokens if available, otherwise fallback to fetched or config tokens
  const destinationTokens = useMemo((): typeof destinationTokensFetched => {
    // Prefer fetched tokens for current chain
    if (destinationTokensFetched.length > 0) {
      return destinationTokensFetched;
    }
    // Use preloaded tokens if available
    const preloaded = preloadedTokens[destinationChainId];
    if (preloaded && preloaded.length > 0) {
      return preloaded;
    }
    // Fallback to config tokens
    return destinationFallback;
  }, [destinationTokensFetched, destinationChainId, destinationFallback, preloadedTokens]);

  const canonicalAddress = (addr: string) =>
    addr.startsWith("0x") ? addr.toLowerCase() : addr;

  useEffect(() => {
    if (originTokens.length === 0) return;
    const validAddresses = new Set(originTokens.map((t) => canonicalAddress(t.address)));
    if (!originToken || !validAddresses.has(canonicalAddress(originToken))) {
      const usdc = originTokens.find((t) => t.symbol === "USDC");
      const sol = originTokens.find((t) => t.symbol === "SOL");
      setOriginToken((usdc ?? sol ?? originTokens[0])?.address ?? "");
    }
  }, [originTokens, originToken]);

  // When destination chain changes, default to USDC on that chain (so user only changes amount or chain).
  useEffect(() => {
    const usdcFromConfig = TOKENS_BY_CHAIN[destinationChainId]?.find((t) => t.symbol === "USDC");
    if (usdcFromConfig) setDestinationToken(usdcFromConfig.address);
  }, [destinationChainId]);

  useEffect(() => {
    if (destinationTokens.length === 0) return;
    const usdc =
      TOKENS_BY_CHAIN[destinationChainId]?.find((t) => t.symbol === "USDC") ??
      destinationTokens.find((t) => t.symbol === "USDC") ??
      destinationTokens[0];
    if (!usdc) return;
    const validAddresses = new Set(destinationTokens.map((t) => canonicalAddress(t.address)));
    if (!destinationToken || !validAddresses.has(canonicalAddress(destinationToken))) {
      setDestinationToken(usdc.address);
    }
  }, [destinationChainId, destinationTokens, destinationToken]);

  const selectedOriginToken = useMemo(
    () =>
      originTokens.find((t) => canonicalAddress(t.address) === canonicalAddress(originToken)) ??
      originTokens[0],
    [originTokens, originToken]
  );
  const originDecimals = selectedOriginToken?.decimals ?? 6;
  const isSOL = selectedOriginToken?.symbol === "SOL";
  const SOL_MINT = "So11111111111111111111111111111111111111112";

  const originTokenOptions: TokenOption[] = useMemo(
    () => originTokens.map((t) => ({ value: t.address, label: t.symbol })),
    [originTokens]
  );
  const destinationChainOptions: DropdownOption[] = useMemo(
    () =>
      DESTINATION_CHAIN_IDS.map((id) => ({
        value: String(id),
        label: getChainName(id),
      })),
    []
  );
  const destinationTokenOptions: TokenOption[] = useMemo(
    () => destinationTokens.map((t) => ({ value: t.address, label: t.symbol })),
    [destinationTokens]
  );

  const rawAmount = useMemo(() => {
    if (!amount.trim()) return "0";
    return humanAmountToRaw(amount.trim(), originDecimals);
  }, [amount, originDecimals]);

  const destIsEvm = isEvmChain(destinationChainId);
  const evmAddressValid = useMemo(() => {
    const state = useSwapStore.getState();
    return computeEvmAddressValid(state);
  }, [destinationChainId, destinationAddressOverride]);
  const recipientAddress = useMemo(() => {
    const state = useSwapStore.getState();
    return computeRecipientAddress(state, publicKey?.toBase58() ?? null);
  }, [publicKey, destIsEvm, evmAddressValid, destinationAddressOverride]);

  // Debug: log whenever destination address state or computed recipient changes
  useEffect(() => {
    if (!destIsEvm) return;
  }, [destIsEvm, destinationAddressOverride, evmAddressValid, recipientAddress, publicKey, wallet?.adapter?.name]);

  // When Solana wallet disconnects or changes: reset form, clear balances, destination, quote, and params
  // so everything is refetched from the newly connected wallet (source + destination).
  useEffect(() => {
    if (!publicKey) {
      setDestinationAddressOverride("");
      setEvmAddressError(null);
      setSelectedQuote(null);
      setParams(null);
      clearBalances();
      resetForm();
      fetchingRef.current = false;
      setEvmAddressFetching(false);
      walletChangeClearedAtRef.current = null;
      return;
    }

    resetForm();
    clearBalances();
    setSelectedQuote(null);
    setParams(null);
    setDestinationAddressOverride("");
    setEvmAddressError(null);
    fetchingRef.current = false;
    setEvmAddressFetching(false);
    walletChangeClearedAtRef.current = Date.now();

    if (destIsEvm) {
      const timer = setTimeout(() => {
        fetchEvmAddress();
        walletChangeClearedAtRef.current = null;
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [publicKey, destIsEvm, fetchEvmAddress, clearBalances, resetForm]);

  // Fetch EVM address when destination is EVM and we don't have a valid address yet.
  // Skip if we just cleared due to wallet change (wallet-change effect will refetch with correct wallet).
  useEffect(() => {
    const clearedAt = walletChangeClearedAtRef.current;
    const skipDueToWalletChange = clearedAt != null && Date.now() - clearedAt < 450;
    if (!destIsEvm || !publicKey) return;
    if (fetchingRef.current) {
      return;
    }
    if (destinationAddressOverride && evmAddressValid) {
      return;
    }
    if (skipDueToWalletChange) {
      return;
    }

    const timer = setTimeout(() => {
      fetchEvmAddress();
    }, 250);
    return () => clearTimeout(timer);
  }, [destIsEvm, destinationAddressOverride, evmAddressValid, fetchEvmAddress]);

  const refreshSolBalance = useCallback(() => {
    if (!connection || !publicKey) return;
    setUserSOLBalance(undefined);
    getSolBalance(connection, publicKey.toBase58())
      .then((balance) => setUserSOLBalance(balance))
      .catch(() => setUserSOLBalance(undefined));
  }, [connection, publicKey, setUserSOLBalance]);

  // Fetch user SOL balance for Execute button (show "Add SOL" only when we know balance is too low).
  useEffect(() => {
    if (!connection || !publicKey) {
      setUserSOLBalance(undefined);
      return;
    }
    let cancelled = false;
    getSolBalance(connection, publicKey.toBase58())
      .then((balance) => {
        if (!cancelled) setUserSOLBalance(balance);
      })
      .catch(() => {
        if (!cancelled) setUserSOLBalance(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [connection, publicKey, setUserSOLBalance]);

  // Fetch source token balance (SOL or token)
  useEffect(() => {
    if (!connection || !publicKey || !originToken || !selectedOriginToken) {
      setUserSourceTokenBalance(undefined);
      return;
    }
    let cancelled = false;
    const fetchBalance = async () => {
      try {
        if (isSOL) {
          const balance = await getSolBalance(connection, publicKey.toBase58());
          if (!cancelled) setUserSourceTokenBalance(balance);
        } else {
          const balance = await getTokenBalance(connection, publicKey.toBase58(), originToken);
          if (!cancelled) setUserSourceTokenBalance(balance);
        }
      } catch {
        if (!cancelled) setUserSourceTokenBalance(undefined);
      }
    };
    fetchBalance();
    return () => {
      cancelled = true;
    };
  }, [connection, publicKey, originToken, selectedOriginToken, isSOL, setUserSourceTokenBalance]);

  // Check for dust and uncloseable accounts when balance or amount changes
  useEffect(() => {
    if (!connection || !publicKey || !originToken || !amount || !userSourceTokenBalance) {
      setDustWarning(null);
      return;
    }

    const checkDust = async () => {
      try {
        const rawAmount = humanAmountToRaw(amount, selectedOriginToken?.decimals ?? 9);
        if (!rawAmount || rawAmount === "0") {
          setDustWarning(null);
          return;
        }

        const mint = isSOL ? "SOL" : originToken;
        const result = await checkDustAndUncloseable(
          connection,
          publicKey.toBase58(),
          mint,
          userSourceTokenBalance,
          rawAmount
        );

        if (result.isDust || result.isUncloseable) {
          setDustWarning({
            isDust: result.isDust,
            isUncloseable: result.isUncloseable,
            dustAmount: result.dustAmount,
            tokenSymbol: selectedOriginToken?.symbol ?? "tokens",
          });
        } else {
          setDustWarning(null);
        }
      } catch (error) {
        console.warn("[SwapPanel] Error checking dust:", error);
        setDustWarning(null);
      }
    };

    checkDust();
  }, [connection, publicKey, originToken, amount, userSourceTokenBalance, selectedOriginToken, isSOL]);

  // Listen for EVM account changes on the provider that matches the connected Solana wallet.
  useEffect(() => {
    if (!destIsEvm || typeof window === "undefined") return;

    const win = window as unknown as {
      ethereum?: {
        on?: (event: string, handler: (accounts: unknown) => void) => void;
        removeListener?: (event: string, handler: (accounts: unknown) => void) => void;
      };
      phantom?: {
        ethereum?: {
          on?: (event: string, handler: (accounts: unknown) => void) => void;
          removeListener?: (event: string, handler: (accounts: unknown) => void) => void;
        };
      };
    };
    const name = wallet?.adapter?.name?.toLowerCase() ?? "";
    const ethereum =
      name.includes("phantom") && win.phantom?.ethereum
        ? win.phantom.ethereum
        : win.ethereum ?? win.phantom?.ethereum;

    if (!ethereum?.on) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const arr = Array.isArray(accounts) ? accounts : [];
      const first = arr[0];
      if (typeof first === "string" && first.startsWith("0x") && first.length === 42) {
        setDestinationAddressOverride(first);
        setEvmAddressError(null);
      } else {
        setDestinationAddressOverride("");
      }
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      if (ethereum?.removeListener) {
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, [destIsEvm, wallet?.adapter?.name]);

  const isSameChain = destinationChainId === ORIGIN_CHAIN_ID;
  const isSameToken =
    originToken.trim().toLowerCase() === destinationToken.trim().toLowerCase();
  const isIllogicalRoute = isSameChain && isSameToken;

  const getBalancesForQuote = useCallback(async () => {
    if (!connection || !publicKey) return undefined;
    const address = publicKey.toBase58();
    const [sol, usdc] = await Promise.all([
      getSolBalance(connection, address),
      getTokenBalance(connection, address, USDC_MINT_SOLANA),
    ]);
    return { userSOLBalance: sol, userSolanaUSDCBalance: usdc };
  }, [connection, publicKey]);

  const swapParams: SwapParams | null = useMemo(() => {
    const state = useSwapStore.getState();
    return computeSwapParams(state, publicKey?.toBase58() ?? null, rawAmount);
  }, [publicKey, originToken, rawAmount, destinationChainId, destinationToken, destIsEvm, evmAddressValid, recipientAddress]);

  // Disable automatic refetching after 20 seconds of inactivity
  // Calculate this before useQuotes so we can pass it as an option
  const shouldDisableAutoRefetch = useMemo(() => {
    if (!paramsLastChangedAt || !params) return false;
    // Check if params haven't changed for 20+ seconds
    return now - paramsLastChangedAt >= QUOTE_STALE_MS;
  }, [paramsLastChangedAt, params, now]);

  const {
    data,
    isLoading,
    isFetching,
    refetch,
    isError,
    error,
  } = useQuotes(params ?? null, getBalancesForQuote, {
    disableAutoRefetch: shouldDisableAutoRefetch,
  });

  const best = data?.best ?? null;
  const quotes = data?.quotes ?? [];
  
  // Calculate activeQuote early so it can be used in useEffect hooks
  const activeQuote = selectedQuote ?? best;

  // Only auto-fetch quote when form is fully filled; wait until user settles input (debounce).
  useEffect(() => {
    if (!swapParams) {
      setParamsLastChangedAt(null);
      return;
    }
    // Reset the "last changed" timestamp when params change
    setParamsLastChangedAt(Date.now());
    const t = setTimeout(() => {
      setParams(swapParams);
      setSelectedQuote(null);
    }, QUOTE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [swapParams, setParams, setSelectedQuote, setParamsLastChangedAt]);

  // Fetch prices when quote changes
  useEffect(() => {
    if (!best) {
      setPrices({ sol: null });
      return;
    }
    
    const fetchPrices = async () => {
      const newPrices: { sol: number | null; [currency: string]: number | null } = { sol: null };
      
      // Fetch SOL price
      try {
        newPrices.sol = await getSolPriceInUsdc();
      } catch (error) {
        console.warn("[SwapPanel] Failed to fetch SOL price:", error);
      }
      
      // Fetch relayer fee currency price
      const feeCurrency = best.userFeeCurrency ?? best.feeCurrency;
      if (feeCurrency && feeCurrency !== "SOL") {
        // USDC/USDT are always $1
        if (feeCurrency === "USDC" || feeCurrency === "USDT") {
          newPrices[feeCurrency] = 1.0;
        } else {
          try {
            // Find token address for the fee currency (check both origin and destination chains)
            const originTokens = TOKENS_BY_CHAIN[ORIGIN_CHAIN_ID] ?? [];
            const destTokens = TOKENS_BY_CHAIN[destinationChainId] ?? [];
            const token = originTokens.find((t) => t.symbol === feeCurrency) ?? 
                         destTokens.find((t) => t.symbol === feeCurrency);
            if (token) {
              // Try destination chain first, then origin
              const chainId = destTokens.find((t) => t.symbol === feeCurrency) ? destinationChainId : ORIGIN_CHAIN_ID;
              newPrices[feeCurrency] = await getTokenPriceUsd(token.address, chainId);
            }
          } catch (error) {
            console.warn(`[SwapPanel] Failed to fetch ${feeCurrency} price:`, error);
          }
        }
      }
      
      // Fetch destination token price (for "Minimum received" USD display)
      if (destinationToken && destinationChainId) {
        const destTokenSymbol = best.feeCurrency; // The token user receives
        if (destTokenSymbol && destTokenSymbol !== "SOL") {
          // USDC/USDT are always $1
          if (destTokenSymbol === "USDC" || destTokenSymbol === "USDT") {
            newPrices[destTokenSymbol] = 1.0;
          } else if (!newPrices[destTokenSymbol]) {
            // Only fetch if we haven't already fetched it (might be same as fee currency)
            try {
              const destTokens = TOKENS_BY_CHAIN[destinationChainId] ?? [];
              const token = destTokens.find((t) => t.symbol === destTokenSymbol);
              if (token) {
                newPrices[destTokenSymbol] = await getTokenPriceUsd(token.address, destinationChainId);
              }
            } catch (error) {
              console.warn(`[SwapPanel] Failed to fetch ${destTokenSymbol} price:`, error);
            }
          }
        }
      }
      
      setPrices(newPrices);
    };

    fetchPrices();
  }, [best, destinationChainId, destinationToken, setPrices]);
  
  // Helper function to format amount with USD value
  const formatAmountWithUsd = useCallback((
    amount: string,
    currency: string,
    priceUsd: number | null
  ): string => {
    const formatted = formatRawAmount(amount, currency);
    if (priceUsd == null || priceUsd === 0) return `${formatted} ${currency}`;
    const usdValue = parseFloat(formatted) * priceUsd;
    const usdFormatted = usdValue < 0.01 ? "<$0.01" : `$${usdValue.toFixed(2)}`;
    return `${formatted} ${currency} (${usdFormatted})`;
  }, []);
  
  // Force re-render to check timeout status periodically
  useEffect(() => {
    if (!best || !paramsLastChangedAt) return;
    const interval = setInterval(() => {
      updateNow();
    }, 1000); // Update every second to check timeout
    return () => clearInterval(interval);
  }, [best, paramsLastChangedAt, updateNow]);
  
  // Quote expiry countdown timer
  useEffect(() => {
    if (!activeQuote) {
      setTimeRemaining(null);
      return;
    }
    
    const updateTimer = () => {
      const remaining = activeQuote.expiryAt - Date.now();
      setTimeRemaining(remaining > 0 ? remaining : 0);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeQuote]);
  
  // Track if quote has expired (background check, no auto-refresh)
  const isQuoteExpired = activeQuote != null && timeRemaining !== null && timeRemaining <= 0;
  
  // Check if quote is expired (based on quote expiry time, not staleness)
  const isExpired =
    best != null && Date.now() >= best.expiryAt;
  // Check if user has sufficient source token balance
  const hasSufficientSourceToken = useMemo(() => {
    // If amount is empty or zero, allow (no swap to execute)
    if (!rawAmount || rawAmount === "0") {
      return true;
    }
    // If balance is still loading, block execution (don't allow until we know)
    if (userSourceTokenBalance === undefined) {
      return false;
    }
    // Need a quote to check relayer fees
    if (!selectedQuote) {
      return false;
    }
    try {
      let required = BigInt(rawAmount);
      
      // Always check relayer fee - it might be in the same currency as source token
      const relayerFeeCurrency = selectedQuote.userFeeCurrency ?? selectedQuote.feeCurrency;
      const sourceTokenSymbol = selectedOriginToken?.symbol;
      const relayerFeeAmount = selectedQuote.userFee && selectedQuote.userFee !== "0" 
        ? selectedQuote.userFee 
        : (selectedQuote.fees && selectedQuote.fees !== "0" ? selectedQuote.fees : "0");
      
      // Always include relayer fee if it's in the same currency as source token
      // This ensures users have enough for both swap amount and relayer fee
      if (relayerFeeAmount !== "0" && relayerFeeCurrency && sourceTokenSymbol) {
        const feeCurrencyUpper = relayerFeeCurrency.toUpperCase();
        const sourceTokenUpper = sourceTokenSymbol.toUpperCase();
        
        // If relayer fee is in the same currency as source token, add it to required amount
        if (feeCurrencyUpper === sourceTokenUpper) {
          try {
            const relayerFee = BigInt(relayerFeeAmount);
            required = required + relayerFee;
          } catch (e) {
            // If relayer fee can't be parsed, block execution to be safe
            if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
              console.warn('[Balance Check] Failed to parse relayer fee', relayerFeeAmount);
            }
            return false;
          }
        }
        // Note: If relayer fee is in SOL, it's checked separately via hasSufficientSol
        // If relayer fee is in a different token, we'd need that token's balance (future enhancement)
      }
      
      const available = BigInt(userSourceTokenBalance);
      const isSufficient = available >= required;
      
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        // Balance check logging removed
        
      }
      return isSufficient;
    } catch (error) {
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.error('[Balance Check Error]', error, { rawAmount, userSourceTokenBalance });
      }
      return false; // Block on parse errors to be safe
    }
  }, [rawAmount, userSourceTokenBalance, selectedOriginToken, selectedQuote]);

  // Only show "Add SOL" when we have a known balance that's too low. If balance is undefined (loading or RPC failed), don't block.
  const hasSufficientSol =
    selectedQuote == null ||
    userSOLBalance === undefined ||
    hasEnoughSolForQuote(selectedQuote, userSOLBalance);
  // Block execution if quote is expired
  const canExecute =
    selectedQuote != null && 
    !executing && 
    !isExpired && 
    !isQuoteExpired &&
    hasSufficientSol && 
    hasSufficientSourceToken;
  const insufficientSourceToken = useMemo(() => {
    if (rawAmount === "0" || !rawAmount) {
      return false;
    }
    // If balance is still loading, don't show insufficient funds yet
    if (userSourceTokenBalance === undefined) {
      return false;
    }
    // Show insufficient funds if balance is loaded and insufficient
    const result = !hasSufficientSourceToken;
    return result;
  }, [rawAmount, userSourceTokenBalance, hasSufficientSourceToken]);

  const receiveDisplay = activeQuote ? computeReceiveDisplay(activeQuote) : null;

  const handleExecute = useCallback(async () => {
    const currentSelectedQuote = useSwapStore.getState().selectedQuote;
    const currentSwapParams = useSwapStore.getState().params;
    if (!currentSelectedQuote || !canExecute || !sendTransaction || !connection || !currentSwapParams) return;
    setExecuting(true);
    setExecuteError(null);
    setExecuteSuccess(null);
    setTransactionStatus(null);
    setTransactionSignature(null);
    try {
      // Block execution if quote requires SOL and user has insufficient balance (fresh check)
      const latestSol = await getSolBalance(connection, publicKey!.toBase58());
      if (!hasEnoughSolForQuote(currentSelectedQuote, latestSol)) {
        setExecuteError("Insufficient SOL for gas. Add ~0.02 SOL to your wallet and try again.");
        return;
      }
      let quoteToExecute = currentSelectedQuote;

      // Relay: Always re-quote and re-validate before execution (with retry)
      if (currentSelectedQuote.provider === "relay") {
        try {
          await withRetry(async () => {
            // Re-fetch quotes from API
            const res = await fetch("/api/quotes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(currentSwapParams),
            });

            if (!res.ok) {
              throw new Error("Failed to re-quote Relay");
            }

            const json = await res.json();
            if (!json.success || !json.data) {
              throw new Error("Invalid response from quote API");
            }

            const freshQuotes = json.data.quotes as NormalizedQuote[];
            const freshQuote = freshQuotes.find((q) => q.provider === "relay");

            if (!freshQuote) {
              throw new Error("Relay quote no longer available");
            }

            // Re-validate solvency
            const validation = validateSponsorProfitability(freshQuote);
            if (!validation.valid) {
              throw new Error(`Quote no longer valid: ${validation.reason}`);
            }

            // Use fresh quote for execution
            quoteToExecute = freshQuote;
            setSelectedQuote(freshQuote);
          });
        } catch (err) {
          setExecuteError(getUserFriendlyErrorMessage(err, { transactionType: "swap", provider: "relay" }));
          return;
        }
      }

      // Check quote expiry before execution
      if (Date.now() >= quoteToExecute.expiryAt) {
        setExecuteError("Quote expired. Please fetch a new quote.");
        // Try to auto-refresh
        try {
          if (quoteToExecute.provider === "relay") {
            await refetch();
          } else if (quoteToExecute.provider === "debridge") {
            const freshQuote = await getDebridgeQuote(currentSwapParams);
            setSelectedQuote(freshQuote);
          }
        } catch (err) {
          // Ignore refresh errors, user can manually refresh
        }
        return;
      }
      
      // DLN: Check expiry and transaction timing
      if (currentSelectedQuote.provider === "debridge") {
        const quoteAge = Date.now() - (currentSelectedQuote.expiryAt - QUOTE_VALIDITY_MS);
        const DEBRIDGE_TRANSACTION_WINDOW_MS = 30_000; // 30 seconds
        const DEBRIDGE_WARNING_THRESHOLD_MS = 25_000; // 25 seconds
        
        if (quoteAge > DEBRIDGE_TRANSACTION_WINDOW_MS) {
          // Quote too old - block execution (beyond 30s window)
          setExecuteError("Quote is too old. Please fetch a new quote for better fulfillment probability.");
          return;
        } else if (quoteAge > DEBRIDGE_WARNING_THRESHOLD_MS) {
          // Quote approaching expiry - warn but allow (between 25-30s)
          console.warn("[SwapPanel] deBridge quote age:", quoteAge, "ms - approaching expiry window");
          // Continue execution but user is warned
        }
      }

      const raw = quoteToExecute.raw as Record<string, unknown>;
      
      // Extract provider-specific IDs
      const relayRequestId = quoteToExecute.provider === "relay" && raw?.steps
        ? (raw.steps as Array<{ requestId?: string }>)[0]?.requestId
        : undefined;
      const debridgeOrderId = quoteToExecute.provider === "debridge" && raw?.orderId
        ? String(raw.orderId)
        : undefined;

      if (quoteToExecute.provider === "debridge" && raw?.tx) {
        const tx = raw.tx as Record<string, unknown>;
        if (typeof window !== "undefined" && (window as unknown as { ethereum?: { request: (args: unknown) => Promise<unknown> } }).ethereum?.request) {
          try {
            setTransactionStatus("pending");
            const hash = await withRetry(async () => {
              return await (window as unknown as { ethereum: { request: (args: unknown) => Promise<unknown> } }).ethereum!.request({
                method: "eth_sendTransaction",
                params: [
                  {
                    to: tx.to,
                    data: tx.data,
                    value: tx.value ?? "0",
                    from: (tx as { from?: string }).from,
                  },
                ],
              });
            });
            const txHash = String(hash);
            setTransactionSignature(txHash);
            
            // Create swap history record
            try {
              const swapRecord = createSwapRecordFromQuote(
                quoteToExecute,
                currentSwapParams,
                txHash,
                null,
                debridgeOrderId
              );
              
              // Update status to confirmed
              updateSwapStatus({
                id: swapRecord.id,
                status: "confirmed",
                transactionHash: txHash,
              });
            } catch (historyErr) {
              console.error("[Swap History] Failed to create swap record:", historyErr);
              // Don't block transaction execution if history fails
            }
            
            setTransactionStatus("confirmed");
            setExecuteSuccess(`Transaction sent. Hash: ${hash}`);
          } catch (err) {
            setTransactionStatus("failed");
            setExecuteError(getUserFriendlyErrorMessage(err, { transactionType: "swap", provider: "debridge" }));
          }
        } else {
          setExecuteError("EVM wallet required for deBridge execution.");
        }
      } else if (quoteToExecute.provider === "relay" && raw?.steps) {
        const steps = raw.steps as Array<{ kind?: string; items?: Array<{ data?: Record<string, unknown> }> }>;
        const firstStep = steps[0];
        const firstItem = firstStep?.items?.[0];
        const data = firstItem?.data;
        if (data && (data.serializedTransaction ?? data.transaction)) {
          const base64 =
            (data.serializedTransaction as string) ?? (data.transaction as string);
          try {
            const bin = atob(base64);
            const buf = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
            const tx = VersionedTransaction.deserialize(buf);
            
            setTransactionStatus("pending");
            const sig = await withRetry(async () => {
              return await sendTransaction(tx, connection, { skipPreflight: false });
            });
            
            setTransactionSignature(sig);
            
            // Create swap history record
            let swapRecordId: string | null = null;
            try {
              const swapRecord = createSwapRecordFromQuote(
                quoteToExecute,
                currentSwapParams,
                sig,
                relayRequestId,
                null
              );
              swapRecordId = swapRecord.id;
            } catch (historyErr) {
              console.error("[Swap History] Failed to create swap record:", historyErr);
              // Don't block transaction execution if history fails
            }
            
            setTransactionStatus("pending");
            
            // Poll Solana transaction status first (origin chain deposit)
            const statusResult = await pollTransactionStatus(connection, sig);
            setTransactionStatus(statusResult.status);
            
            // Update swap history with origin transaction status
            if (swapRecordId) {
              try {
                const statusMap: Record<TransactionStatus, "pending" | "confirmed" | "finalized" | "failed"> = {
                  pending: "pending",
                  confirmed: "confirmed",
                  finalized: "finalized",
                  failed: "failed",
                };
                updateSwapStatus({
                  id: swapRecordId,
                  status: statusMap[statusResult.status] ?? "pending",
                  transactionHash: sig,
                  errorMessage: statusResult.error ? String(statusResult.error) : null,
                });
              } catch (historyErr) {
                console.error("[Swap History] Failed to update swap status:", historyErr);
              }
            }
            
            // If origin transaction failed, stop here
            if (statusResult.status === "failed") {
              setExecuteError(getUserFriendlyErrorMessage(statusResult.error ?? new Error("Transaction failed"), { transactionType: "swap", provider: "relay" }));
              return;
            }
            
            // If origin transaction succeeded, monitor Relay bridge status
            // This tracks the full bridge lifecycle: waiting -> pending -> success/failure/refund
            if (relayRequestId && swapRecordId) {
              try {
                setTransactionStatus("pending"); // Show pending while monitoring bridge
                
                // Poll bridge status (monitors destination chain fulfillment)
                const bridgeStatus = await pollRelayBridgeStatus(relayRequestId);
                const swapStatus = mapRelayStatusToSwapStatus(bridgeStatus.status);
                
                // Update swap history with bridge status and destination transaction hash
                if (swapRecordId) {
                  try {
                    const destinationTxHash = bridgeStatus.txHashes?.[0] ?? undefined;
                    updateSwapStatus({
                      id: swapRecordId,
                      status: swapStatus,
                      destinationTransactionHash: destinationTxHash,
                      errorMessage: bridgeStatus.error ?? (bridgeStatus.status === "failure" || bridgeStatus.status === "refund" ? "Bridge failed or refunded" : null),
                      completedAt: bridgeStatus.status === "success" ? new Date() : null,
                    });
                  } catch (historyErr) {
                    console.error("[Swap History] Failed to update bridge status:", historyErr);
                  }
                }
                
                // Update UI based on final bridge status
                if (bridgeStatus.status === "success") {
                  const destinationTxHash = bridgeStatus.txHashes?.[0];
                  const successMessage = destinationTxHash
                    ? `Bridge completed successfully! Origin: ${sig.slice(0, 8)}... Destination: ${destinationTxHash.slice(0, 8)}...`
                    : `Bridge completed successfully! Origin tx: ${sig}`;
                  setExecuteSuccess(successMessage);
                  setTransactionStatus("finalized");
                } else if (bridgeStatus.status === "refund") {
                  setExecuteError("Bridge failed and funds were refunded. Check your wallet.");
                  setTransactionStatus("failed");
                } else if (bridgeStatus.status === "failure") {
                  setExecuteError(bridgeStatus.error ?? "Bridge failed. Check transaction status.");
                  setTransactionStatus("failed");
                } else {
                  // Still pending - show origin transaction success
                  setExecuteSuccess(`Origin transaction confirmed. Bridge in progress... View: https://explorer.solana.com/tx/${sig}`);
                }
              } catch (bridgeErr) {
                console.error("[Relay Bridge] Error monitoring bridge status:", bridgeErr);
                // Don't fail the whole operation if bridge status check fails
                // Origin transaction succeeded, so show success
                setExecuteSuccess(`Transaction confirmed. Bridge in progress... View: https://explorer.solana.com/tx/${sig}`);
              }
            } else {
              // No requestId - can't monitor bridge status, just show origin transaction status
              if (statusResult.status === "finalized") {
                setExecuteSuccess(`Transaction finalized. View: https://explorer.solana.com/tx/${sig}`);
              } else if (statusResult.status === "confirmed") {
                setExecuteSuccess(`Transaction confirmed. View: https://explorer.solana.com/tx/${sig}`);
              }
            }
          } catch (err) {
            setTransactionStatus("failed");
            console.error("Relay Solana send failed:", err);
            setExecuteError(getUserFriendlyErrorMessage(err, { transactionType: "swap", provider: "relay" }));
          }
        } else {
          setExecuteError("Relay execution: no Solana transaction in step. Raw logged to console.");
          console.log("Relay first step data:", firstItem?.data);
        }
      } else {
        setExecuteError("Execution not implemented for this provider/chain. Check console for raw payload.");
        console.log("Quote raw payload:", raw);
      }
    } catch (e) {
      setTransactionStatus("failed");
      setExecuteError(getUserFriendlyErrorMessage(e, { transactionType: "swap" }));
    } finally {
      setExecuting(false);
    }
  }, [canExecute, connection, publicKey, sendTransaction, setExecuting, setExecuteError, setExecuteSuccess, setSelectedQuote]);

  useEffect(() => {
    if (best && !selectedQuote) setSelectedQuote(best);
  }, [best, selectedQuote, setSelectedQuote]);

  return (
    <div {...stylex.props(styles.panelContainer)}>
      <section {...stylex.props(styles.section)}>
        {/* From */}
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
                  if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
                }}
                placeholder="0.0"
                {...stylex.props(styles.amountInput)}
                style={{
                  background: 'transparent',
                  backgroundColor: 'transparent',
                }}
              />
              {userSourceTokenBalance !== undefined && (
                <div {...stylex.props(styles.balanceText)}>
                  Balance: {formatRawAmount(String(userSourceTokenBalance), selectedOriginToken?.symbol ?? "")} {selectedOriginToken?.symbol ?? ""}
                </div>
              )}
            </div>
            <div {...stylex.props(styles.tokenSelectContainer)}>
              <TokenSelect
                options={originTokenOptions}
                value={originToken}
                onChange={setOriginToken}
                placeholder="Select token"
                chainBadgeUrl="/solana.png"
              />
            </div>
          </div>
        </div>

        <div {...stylex.props(styles.arrowContainer)}>
          <span {...stylex.props(styles.arrowIcon)} aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          </span>
        </div>

        {/* To */}
        <div {...stylex.props(styles.toSection)}>
          <div {...stylex.props(styles.toAmountHeaderRow)}>
            <span {...stylex.props(styles.toLabel)}>You receive</span>
          </div>
          <div {...stylex.props(styles.toAmountContent)}>
            <div {...stylex.props(styles.toAmountWrapper)}>
              <input
                type="text"
                inputMode="decimal"
                value={
                  receiveDisplay?.estimatedOutFormatted 
                    ? (() => {
                        const num = parseFloat(receiveDisplay.estimatedOutFormatted);
                        return isNaN(num) ? receiveDisplay.estimatedOutFormatted : num.toFixed(3).replace(/\.?0+$/, '');
                      })()
                    : "0.0"
                }
                readOnly
                placeholder="0.0"
                {...stylex.props(styles.amountInput)}
                style={{
                  background: 'transparent',
                  backgroundColor: 'transparent',
                }}
              />
            </div>
            <div {...stylex.props(styles.destinationSelectorContainer)}>
              <DestinationSelector
                destinationChainId={destinationChainId}
                destinationToken={destinationToken}
                destinationChainOptions={destinationChainOptions}
                destinationTokenOptions={destinationTokenOptions}
                onChangeChain={setDestinationChainId}
                onChangeToken={setDestinationToken}
              />
            </div>
          </div>
        </div>

        <div {...stylex.props(layout.flexColGap)}>
          {dustWarning && (dustWarning.isDust || dustWarning.isUncloseable) && (
            <div 
              {...stylex.props(styles.warningBanner)}
              className="fade-in-animation"
            >
              <span {...stylex.props(styles.warningIcon)} aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </span>
              <div>
                {dustWarning.isDust && (
                  <div>
                    <strong>Warning:</strong> This swap will leave {formatRawAmount(dustWarning.dustAmount, dustWarning.tokenSymbol)} {dustWarning.tokenSymbol} that cannot be recovered (dust amount below rent-exempt minimum).
                  </div>
                )}
                {dustWarning.isUncloseable && (
                  <div>
                    <strong>Warning:</strong> This swap will leave your account balance exactly at the rent-exempt minimum, making it uncloseable without losing the rent deposit.
                  </div>
                )}
              </div>
            </div>
          )}
          {destIsEvm && evmAddressError && (
            <p {...stylex.props(styles.errorText)}>
              {evmAddressError.includes('MetaMask') || evmAddressError.includes('Phantom') ? (
                <>
                  {evmAddressError.split(/(MetaMask|Phantom)/).filter(Boolean).map((part, i) => {
                    if (part === 'MetaMask') {
                      return (
                        <a
                          key={i}
                          href="https://metamask.io/"
                          target="_blank"
                          rel="noopener noreferrer"
                          {...stylex.props(styles.errorLink)}
                          style={{ textDecoration: 'underline' }}
                        >
                          MetaMask
                        </a>
                      );
                    }
                    if (part === 'Phantom') {
                      return (
                        <a
                          key={i}
                          href="https://phantom.app/"
                          target="_blank"
                          rel="noopener noreferrer"
                          {...stylex.props(styles.errorLink)}
                          style={{ textDecoration: 'underline' }}
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
          {isIllogicalRoute && (
            <p {...stylex.props(styles.invalidRouteText)}>
              Same token on same chain is not a valid swap. Choose a different destination token or chain.
            </p>
          )}
        </div>

        {/* Best quote in same interface (MetaMask-style) */}
        {params != null && (
          <div {...stylex.props(styles.quoteSection)}>
            {/* Always render fee breakdown - show placeholders when loading/no quote */}
            <div {...stylex.props(styles.quoteDetails)}>
              {(() => {
                const q = selectedQuote ?? best;
                if (!q) {
                  // Show placeholder values when no quote
                  return (
                    <div {...stylex.props(styles.itemizedSection)}>
                      <div {...stylex.props(styles.itemizedRow)}>
                        <span {...stylex.props(styles.itemizedLabel)}>Network fee</span>
                        <span {...stylex.props(styles.itemizedValue)}>—</span>
                      </div>
                      <div {...stylex.props(styles.itemizedRow)}>
                        <span {...stylex.props(styles.itemizedLabel)}>Relayer fee</span>
                        <span {...stylex.props(styles.itemizedValue)}>—</span>
                      </div>
                    </div>
                  );
                }

                const { effectiveReceive, effectiveReceiveFormatted } = computeReceiveDisplay(q);

                if (process.env.NODE_ENV === "development") {
                  const expectedOutNum = BigInt(q.expectedOut);
                  const expectedOutFormattedNum = parseFloat(q.expectedOutFormatted);
                  const useRatio =
                    expectedOutNum > BigInt(0) &&
                    Number.isFinite(expectedOutFormattedNum) &&
                    expectedOutFormattedNum >= 0;
                }

                const isGasless = !!q.gasless;
                const networkFeeDisplay =
                  isGasless
                    ? "Sponsored"
                    : q.solanaCostToUser && q.solanaCostToUser !== "0"
                      ? `-~${formatAmountWithUsd(q.solanaCostToUser, "SOL", prices.sol)}`
                      : "—";
                const relayerFeeCurrency = q.userFeeCurrency ?? q.feeCurrency ?? "USDC";
                const relayerFeeAmount = q.userFee && q.userFee !== "0" ? q.userFee : q.fees && q.fees !== "0" ? q.fees : "0";
                // Get price - handle SOL case (stored as "sol" lowercase)
                const relayerFeePrice = relayerFeeCurrency === "SOL" 
                  ? prices.sol 
                  : prices[relayerFeeCurrency] ?? null;
                const relayerFeeDisplay =
                  relayerFeeAmount !== "0"
                    ? `-${formatAmountWithUsd(relayerFeeAmount, relayerFeeCurrency, relayerFeePrice)}`
                    : "0";

                return (
                  <>
                    <div {...stylex.props(styles.itemizedSection)}>
                      <div {...stylex.props(styles.itemizedRow)}>
                        <span {...stylex.props(styles.itemizedLabel)}>Network fee</span>
                        <span {...stylex.props(styles.itemizedValue)}>{networkFeeDisplay}</span>
                      </div>
                      <div {...stylex.props(styles.itemizedRow)}>
                        <span {...stylex.props(styles.itemizedLabel)}>Relayer fee</span>
                        <span {...stylex.props(styles.itemizedValueRed)}>{relayerFeeDisplay}</span>
                      </div>
                      {q.priceDrift != null && q.priceDrift > 0 && (
                        <div {...stylex.props(styles.itemizedRow)}>
                          <span {...stylex.props(styles.itemizedLabel)}>Price drift</span>
                          <span {...stylex.props(styles.itemizedValue)}>{(q.priceDrift * 100).toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                    {/* Show expired message when quote expires */}
                    {!executing && isQuoteExpired && (
                      <div {...stylex.props(styles.timeoutMessage)}>
                        <span>Quote expired.</span>
                        <button
                          type="button"
                          onClick={async () => {
                            setSelectedQuote(null);
                            const newTimestamp = Date.now();
                            setParamsLastChangedAt(newTimestamp);
                            await refetch();
                          }}
                          disabled={isFetching}
                          {...stylex.props(
                            buttons.textLink,
                            isFetching && buttons.textLinkDisabled
                          )}
                          style={{ 
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            boxShadow: 'none',
                          }}
                        >
                          Refetch new quote?
                        </button>
                      </div>
                    )}
                                      </>
                );
              })()}
            </div>

            {/* Loading/error states appear between fees and action button */}
            {isLoading && (
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
            )}
            {isError && (
              <div {...stylex.props(styles.errorSection)}>
                <p {...stylex.props(
                  error && (error as Error & { code?: string }).code === "NEED_SOL_FOR_GAS" 
                    ? styles.errorMessage 
                    : styles.errorMessageNoMargin
                )}>
                  {error?.message ?? "Failed to load quotes"}
                </p>
                {error && (error as Error & { code?: string }).code === "NEED_SOL_FOR_GAS" && (
                  <p {...stylex.props(styles.errorHint)}>
                    Get SOL from an exchange or a faucet, send it to your connected wallet, then try again.
                  </p>
                )}
              </div>
            )}
            {data && !isLoading && quotes.length === 0 && (
              <p {...stylex.props(styles.noRoutesText)}>
                No routes available for this pair. Try a different amount or token.
              </p>
            )}
            {params != null && !data && !isLoading && !isError && (
              <div {...stylex.props(styles.loadingContainer)}>
                <LoadingSpinner size={16} />
                <span {...stylex.props(styles.gettingQuoteText)}>Getting your quote…</span>
              </div>
            )}

            {/* Always render action button - only show when valid or insufficient funds */}
            <div {...stylex.props(styles.actionRow)}>
              {(() => {
                if (rawAmount === "0" || !rawAmount || isLoading) {
                  return null;
                }
                if (insufficientSourceToken) {
                  return (
                    <button
                      type="button"
                      disabled
                      {...stylex.props(styles.insufficientFundsButton)}
                    >
                      Insufficient funds
                    </button>
                  );
                }
                if (canExecute && best) {
                  return (
                    <button
                      type="button"
                      onClick={handleExecute}
                      disabled={executing}
                      {...stylex.props(
                        styles.swapButton,
                        executing && styles.swapButtonDisabled
                      )}
                    >
                      {executing
                        ? transactionStatus === "pending"
                          ? "Swapping…"
                          : transactionStatus === "confirmed"
                            ? "Swapped"
                            : transactionStatus === "finalized"
                              ? "Swapped"
                              : "Swapping…"
                        : "Swap"}
                    </button>
                  );
                }
                return null;
              })()}
            </div>

            {/* Transaction status display */}
            {transactionStatus && transactionSignature && (
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
                <div {...stylex.props(styles.statusIcon)}>
                  {transactionStatus === "pending" && (
                    <LoadingSpinner size={16} />
                  )}
                  {transactionStatus === "confirmed" && "✓"}
                  {transactionStatus === "finalized" && "✓"}
                  {transactionStatus === "failed" && "✗"}
                </div>
                <div style={{ flex: 1 }}>
                  <div>
                    Transaction {transactionStatus === "pending" && "pending"}
                    {transactionStatus === "confirmed" && "confirmed"}
                    {transactionStatus === "finalized" && "finalized"}
                    {transactionStatus === "failed" && "failed"}
                  </div>
                  {transactionStatus !== "failed" && (
                    <a
                      href={
                        activeQuote?.provider === "relay"
                          ? `https://explorer.solana.com/tx/${transactionSignature}`
                          : `https://etherscan.io/tx/${transactionSignature}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      {...stylex.props(styles.transactionLink)}
                    >
                      View on Explorer
                    </a>
                  )}
                </div>
              </div>
            )}
            
            {/* Execution success/error messages */}
            {executeSuccess && (
              <div 
                {...stylex.props(styles.successMessage)}
                className="fade-in-animation"
              >
                <span {...stylex.props(styles.statusIcon)}>✓</span>
                <span>{executeSuccess}</span>
              </div>
            )}
            {executeError && (
              <div 
                {...stylex.props(styles.executeErrorMessage)}
                className="fade-in-animation"
              >
                <span {...stylex.props(styles.statusIcon)}>✗</span>
                <span>{executeError}</span>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
