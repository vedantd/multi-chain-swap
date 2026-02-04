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

// Internal types
import type { DropdownOption, SwapParams, TokenOption } from "@/types/swap";

// Internal utilities/lib functions
import {
  CHAIN_ID_SOLANA,
  DESTINATION_CHAIN_IDS,
  getChainName,
  humanAmountToRaw,
  isEvmChain,
  TOKENS_BY_CHAIN,
} from "@/lib/chainConfig";
import { getChainLogoUrl } from "@/lib/utils/chainLogo";
import { QUOTE_STALE_MS, USDC_MINT_SOLANA } from "@/lib/constants";
import { getDebridgeQuote } from "@/lib/debridge";
import {
  hasEnoughSolForQuote,
  computeReceiveDisplay,
} from "@/lib/swap";
import { getSolBalance, getTokenBalance } from "@/lib/solana/balance";
import type { TransactionStatus } from "@/lib/solana/transactionStatus";
import { getUserFriendlyErrorMessage } from "@/lib/wallet/errors";
import { executeQuote, type ExecutionContext } from "@/lib/swap";

// Internal components
import { PaySection } from "@/components/swap/form/PaySection";
import { ReceiveSection } from "@/components/swap/form/ReceiveSection";
import { SwapWarnings } from "@/components/swap/quote/SwapWarnings";
import { QuoteDetailsSection } from "@/components/swap/quote/QuoteDetailsSection";
import { QuoteFeedbackSection } from "@/components/swap/quote/QuoteFeedbackSection";
import { SwapActionButton } from "@/components/swap/execution/SwapActionButton";
import { TransactionStatusBanner } from "@/components/swap/execution/TransactionStatusBanner";
import { ExecutionResultCards } from "@/components/swap/execution/ExecutionResultCards";

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
import { useSwapPanelStore } from "@/hooks/useSwapPanelStore";
import { useEvmAddress } from "@/hooks/useEvmAddress";
import { useSwapBalances } from "@/hooks/useSwapBalances";
import { useQuoteParamsSync } from "@/hooks/useQuoteParamsSync";
import { useQuotePrices } from "@/hooks/useQuotePrices";
import { useDustWarning } from "@/hooks/useDustWarning";
import { useQuoteExpiryTimer } from "@/hooks/useQuoteExpiryTimer";


// Styles
import { layout } from "@/styles/shared.stylex";
import { swapPanelStyles as styles } from "@/components/swap/styles/SwapPanel.stylex";

const ORIGIN_CHAIN_ID = CHAIN_ID_SOLANA;

export function SwapPanel() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signTransaction, wallet } = useWallet();

  const {
    originToken,
    amount,
    destinationChainId,
    destinationToken,
    destinationAddressOverride,
    evmAddressError,
    userSOLBalance,
    userSourceTokenBalance,
    params,
    selectedQuote,
    executing,
    executeError,
    executeSuccess,
    balanceInvalidationCounter,
    paramsLastChangedAt,
    prices,
    now,
    setOriginToken,
    setAmount,
    setDestinationChainId,
    setDestinationToken,
    setDestinationAddressOverride,
    setEvmAddressFetching,
    setEvmAddressError,
    setUserSOLBalance,
    setUserSourceTokenBalance,
    setParams,
    setSelectedQuote,
    setExecuting,
    setExecuteError,
    setExecuteSuccess,
    setParamsLastChangedAt,
    setPrices,
    updateNow,
    clearBalances,
    resetForm,
  } = useSwapPanelStore();

  /** After clearing destination due to wallet change, skip the "fetch when empty" effect so only the wallet-change refetch runs (with correct wallet). */
  const walletChangeClearedAtRef = useRef<number | null>(null);

  const destIsEvm = isEvmChain(destinationChainId);
  const evmAddressValid = useMemo(() => {
    const state = useSwapStore.getState();
    return computeEvmAddressValid(state);
  }, [destinationChainId, destinationAddressOverride]);

  const { fetchEvmAddress } = useEvmAddress({
    walletName: wallet?.adapter?.name,
    destIsEvm,
    destinationAddressOverride,
    evmAddressValid,
    setDestinationAddressOverride,
    setEvmAddressError,
    setEvmAddressFetching,
    walletChangeClearedAtRef,
  });

  const { tokens: originTokensFetched } = useSupportedTokens(ORIGIN_CHAIN_ID);
  const { tokens: destinationTokensFetched } = useSupportedTokens(destinationChainId, {
    enabled: !!originToken,
  });

  // Preload tokens for all destination chains in the background
  const [preloadedTokens, setPreloadedTokens] = useState<Record<number, typeof destinationTokensFetched>>({});
  
  // Transaction tracking state
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus | null>(null);
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);

  // Auto-dismiss success message after 5 seconds so it doesn't stay on screen
  useEffect(() => {
    if (!executeSuccess) return;
    const t = setTimeout(() => setExecuteSuccess(null), 5_000);
    return () => clearTimeout(t);
  }, [executeSuccess, setExecuteSuccess]);
  
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

  const dustWarning = useDustWarning({
    connection,
    publicKey,
    originToken,
    amount,
    userSourceTokenBalance,
    selectedOriginToken,
    isSOL,
  });

  useSwapBalances({
    connection,
    publicKey,
    originToken,
    selectedOriginToken,
    isSOL,
    balanceInvalidationCounter,
    setUserSOLBalance,
    setUserSourceTokenBalance,
  });

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

  const recipientAddress = useMemo(() => {
    const state = useSwapStore.getState();
    return computeRecipientAddress(state, publicKey?.toBase58() ?? null);
  }, [publicKey, destIsEvm, evmAddressValid, destinationAddressOverride]);

  // When Solana wallet disconnects or changes: reset form, clear balances, destination, quote, and params
  // so everything is refetched from the newly connected wallet (source + destination).
  const prevPublicKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const prevPublicKey = prevPublicKeyRef.current;
    const currentPublicKey = publicKey?.toBase58() ?? null;

    if (prevPublicKey === currentPublicKey) {
      return;
    }

    if (!publicKey) {
      prevPublicKeyRef.current = null;
      setDestinationAddressOverride("");
      setEvmAddressError(null);
      setSelectedQuote(null);
      setParams(null);
      clearBalances();
      resetForm();
      walletChangeClearedAtRef.current = null;
      return;
    }

    // Capture wallet name for refetch so we use the newly connected wallet (not a stale closure).
    const currentWalletName = wallet?.adapter?.name;

    resetForm();
    clearBalances();
    setSelectedQuote(null);
    setParams(null);
    setDestinationAddressOverride("");
    setEvmAddressError(null);
    walletChangeClearedAtRef.current = Date.now();

    const currentDestChainId = useSwapStore.getState().destinationChainId;
    const currentDestIsEvm = isEvmChain(currentDestChainId);
    if (currentDestIsEvm) {
      const isMetaMask = (currentWalletName ?? "").toLowerCase().includes("metamask");
      const delayMs = isMetaMask ? 150 : 0;
      const timer = setTimeout(() => {
        if (currentWalletName?.trim()) {
          fetchEvmAddress(currentWalletName);
        }
        walletChangeClearedAtRef.current = null;
        prevPublicKeyRef.current = currentPublicKey;
      }, delayMs);
      return () => clearTimeout(timer);
    }
    prevPublicKeyRef.current = currentPublicKey;
  }, [publicKey, wallet?.adapter?.name, fetchEvmAddress, clearBalances, resetForm]);

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
  const activeQuote = selectedQuote ?? best;

  useQuoteParamsSync({
    swapParams,
    setParams,
    setSelectedQuote,
    setParamsLastChangedAt,
  });

  useQuotePrices({
    best,
    originChainId: ORIGIN_CHAIN_ID,
    destinationChainId,
    destinationToken,
    setPrices,
  });

  const { isQuoteExpired } = useQuoteExpiryTimer(activeQuote);
  
  // Tick store "now" so staleness (QUOTE_STALE_MS) can disable auto-refetch after 20s
  useEffect(() => {
    if (!best || !paramsLastChangedAt) return;
    const interval = setInterval(() => updateNow(), 1000);
    return () => clearInterval(interval);
  }, [best, paramsLastChangedAt, updateNow]);
  
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
    const isJupiter = currentSelectedQuote?.provider === "jupiter";
    if (!currentSelectedQuote || !canExecute || !connection || !currentSwapParams) return;
    if (!isJupiter && !sendTransaction) return;
    if (isJupiter && !signTransaction) {
      setExecuteError("Wallet does not support signing. Try a different wallet.");
      return;
    }
    setExecuting(true);
    setExecuteError(null);
    setExecuteSuccess(null);
    setTransactionStatus(null);
    setTransactionSignature(null);
    try {
      const latestSol = await getSolBalance(connection, publicKey!.toBase58());
      if (!hasEnoughSolForQuote(currentSelectedQuote, latestSol)) {
        setExecuteError("Insufficient SOL for gas. Add ~0.02 SOL to your wallet and try again.");
        return;
      }
      const ctx: ExecutionContext = {
        connection,
        publicKey,
        sendTransaction: sendTransaction ?? (() => Promise.reject(new Error("sendTransaction required"))),
        signTransaction: signTransaction ?? undefined,
        setTransactionStatus,
        setTransactionSignature,
        setExecuteError,
        setExecuteSuccess,
        setSelectedQuote,
        refetchQuotes: refetch,
        getDebridgeQuote,
        walletName: wallet?.adapter?.name,
      };
      await executeQuote(currentSelectedQuote, currentSwapParams, ctx);
    } catch (e) {
      setTransactionStatus("failed");
      setExecuteError(getUserFriendlyErrorMessage(e, { transactionType: "swap" }));
    } finally {
      setExecuting(false);
    }
  }, [canExecute, connection, publicKey, sendTransaction, signTransaction, refetch, setExecuting, setExecuteError, setExecuteSuccess, setSelectedQuote, setTransactionStatus, setTransactionSignature]);

  useEffect(() => {
    if (best && !selectedQuote) setSelectedQuote(best);
  }, [best, selectedQuote, setSelectedQuote]);

  return (
    <div {...stylex.props(styles.panelContainer)}>
      <section {...stylex.props(styles.section)}>
        <PaySection
          amount={amount}
          onAmountChange={setAmount}
          originToken={originToken}
          setOriginToken={setOriginToken}
          originTokenOptions={originTokenOptions}
          chainBadgeUrl={getChainLogoUrl(ORIGIN_CHAIN_ID) ?? undefined}
          userSourceTokenBalance={userSourceTokenBalance}
          selectedOriginToken={selectedOriginToken}
        />

        <div {...stylex.props(styles.arrowContainer)}>
          <span {...stylex.props(styles.arrowIcon)} aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "100%", height: "100%" }}>
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </span>
        </div>

        <ReceiveSection
          receiveDisplay={receiveDisplay}
          destinationChainId={destinationChainId}
          destinationToken={destinationToken}
          destinationChainOptions={destinationChainOptions}
          destinationTokenOptions={destinationTokenOptions}
          onChangeChain={setDestinationChainId}
          onChangeToken={setDestinationToken}
          hideAmount={!!executeSuccess}
        />

        <div {...stylex.props(layout.flexColGap)}>
          <SwapWarnings
            dustWarning={dustWarning}
            evmAddressError={evmAddressError}
            destIsEvm={destIsEvm}
          />
        </div>

        {/* Best quote in same interface (MetaMask-style) */}
        {params != null && (
          <div {...stylex.props(styles.quoteSection)}>
            {/* Always render fee breakdown - show placeholders when loading/no quote */}
            <div {...stylex.props(styles.quoteDetails)}>
              <QuoteDetailsSection
                quote={selectedQuote ?? best ?? null}
                prices={prices}
                isQuoteExpired={isQuoteExpired}
                executing={executing}
                isFetching={isFetching}
                onRefetch={async () => {
                  setSelectedQuote(null);
                  setParamsLastChangedAt(Date.now());
                  await refetch();
                }}
              />
            </div>

            <QuoteFeedbackSection
              isLoading={isLoading}
              isError={isError}
              error={error}
              data={data}
              quotes={quotes}
              params={params}
              relayUnavailableHint={
                ORIGIN_CHAIN_ID !== destinationChainId &&
                quotes.length > 0 &&
                !quotes.some((q) => (q as { provider?: string }).provider === "relay")
              }
            />

            <div {...stylex.props(styles.actionRow)}>
              <SwapActionButton
                rawAmount={rawAmount}
                isLoading={isLoading}
                insufficientSourceToken={insufficientSourceToken}
                canExecute={canExecute}
                best={best}
                executing={executing}
                transactionStatus={transactionStatus}
                onExecute={handleExecute}
              />
            </div>

            <TransactionStatusBanner
              transactionStatus={transactionStatus}
              transactionSignature={transactionSignature}
              executeSuccess={executeSuccess}
              activeQuote={activeQuote}
            />

            <ExecutionResultCards
              executeSuccess={executeSuccess}
              executeError={executeError}
              onDismissSuccess={() => setExecuteSuccess(null)}
              onDismissError={() => setExecuteError(null)}
            />
          </div>
        )}
      </section>
    </div>
  );
}
