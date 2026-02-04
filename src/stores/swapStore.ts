/**
 * Swap Store (Zustand)
 * 
 * Centralized state management for the swap interface.
 * Manages form state, UI state, balances, quotes, execution, and prices.
 * 
 * Server state (quotes, supported tokens) remains in TanStack Query.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NormalizedQuote, SwapParams } from "@/types/swap";
import { CHAIN_ID_SOLANA, TOKENS_BY_CHAIN } from "@/lib/chainConfig";
import { isEvmChain } from "@/lib/chainConfig";
import { isValidEvmAddress } from "@/lib/utils/address";

// ============================================================================
// Store State Interface
// ============================================================================

interface SwapStoreState {
  // Form State
  originToken: string;
  amount: string;
  destinationChainId: number;
  destinationToken: string;
  destinationAddressOverride: string;

  // UI State
  evmAddressFetching: boolean;
  evmAddressError: string | null;
  evmDefaultWalletHintDismissed: boolean;

  // Balance State
  userSOLBalance: string | undefined;
  userSourceTokenBalance: string | undefined;

  // Quote State
  params: SwapParams | null;
  selectedQuote: NormalizedQuote | null;
  paramsLastChangedAt: number | null;

  // Execution State
  executing: boolean;
  executeError: string | null;
  executeSuccess: string | null;
  /** Incremented when a swap succeeds; used to trigger balance refetch without cancelling when success is dismissed */
  balanceInvalidationCounter: number;

  // Price State
  prices: { sol: number | null; [currency: string]: number | null };

  // Timing State (for quote staleness)
  now: number;
}

// ============================================================================
// Store Actions Interface
// ============================================================================

interface SwapStoreActions {
  // Form Actions
  setOriginToken: (token: string) => void;
  setAmount: (amount: string) => void;
  setDestinationChainId: (chainId: number) => void;
  setDestinationToken: (token: string) => void;
  setDestinationAddressOverride: (address: string) => void;

  // UI Actions
  setEvmAddressFetching: (fetching: boolean) => void;
  setEvmAddressError: (error: string | null) => void;
  setEvmDefaultWalletHintDismissed: (dismissed: boolean) => void;

  // Balance Actions
  setUserSOLBalance: (balance: string | undefined) => void;
  setUserSourceTokenBalance: (balance: string | undefined) => void;
  clearBalances: () => void;

  // Quote Actions
  setParams: (params: SwapParams | null) => void;
  setSelectedQuote: (quote: NormalizedQuote | null) => void;
  setParamsLastChangedAt: (timestamp: number | null) => void;
  clearQuoteState: () => void;

  // Execution Actions
  setExecuting: (executing: boolean) => void;
  setExecuteError: (error: string | null) => void;
  setExecuteSuccess: (success: string | null) => void;
  clearExecutionState: () => void;

  // Price Actions
  setPrices: (prices: { sol: number | null; [currency: string]: number | null }) => void;
  setSolPrice: (price: number | null) => void;
  setTokenPrice: (currency: string, price: number | null) => void;

  // Timing Actions
  updateNow: () => void;

  // Reset Actions
  resetForm: () => void;
  resetAll: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const getInitialOriginToken = (): string => {
  const usdc = TOKENS_BY_CHAIN[CHAIN_ID_SOLANA]?.find((t) => t.symbol === "USDC");
  return usdc?.address ?? "";
};

const getInitialDestinationToken = (chainId: number): string => {
  const usdc = TOKENS_BY_CHAIN[chainId]?.find((t) => t.symbol === "USDC");
  return usdc?.address ?? "";
};

const initialState: SwapStoreState = {
  // Form State
  originToken: getInitialOriginToken(),
  amount: "",
  destinationChainId: 8453, // Base
  destinationToken: getInitialDestinationToken(8453),
  destinationAddressOverride: "",

  // UI State
  evmAddressFetching: false,
  evmAddressError: null,
  evmDefaultWalletHintDismissed: false,

  // Balance State
  userSOLBalance: undefined,
  userSourceTokenBalance: undefined,

  // Quote State
  params: null,
  selectedQuote: null,
  paramsLastChangedAt: null,

  // Execution State
  executing: false,
  executeError: null,
  executeSuccess: null,
  balanceInvalidationCounter: 0,

  // Price State
  prices: { sol: null },

  // Timing State
  now: Date.now(),
};

// ============================================================================
// Store Definition
// ============================================================================

type SwapStore = SwapStoreState & SwapStoreActions;

export const useSwapStore = create<SwapStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Form Actions (clear success when user changes form so banner doesn't stick)
      setOriginToken: (token) => set({ originToken: token, executeSuccess: null }),
      setAmount: (amount) => set({ amount, executeSuccess: null }),
      setDestinationChainId: (chainId) => {
        const usdc = TOKENS_BY_CHAIN[chainId]?.find((t) => t.symbol === "USDC");
        set({
          destinationChainId: chainId,
          destinationToken: usdc?.address ?? get().destinationToken,
          executeSuccess: null,
        });
      },
      setDestinationToken: (token) => set({ destinationToken: token, executeSuccess: null }),
      setDestinationAddressOverride: (address) => set({ destinationAddressOverride: address }),

      // UI Actions
      setEvmAddressFetching: (fetching) => set({ evmAddressFetching: fetching }),
      setEvmAddressError: (error) => set({ evmAddressError: error }),
      setEvmDefaultWalletHintDismissed: (dismissed) => set({ evmDefaultWalletHintDismissed: dismissed }),

      // Balance Actions
      setUserSOLBalance: (balance) => set({ userSOLBalance: balance }),
      setUserSourceTokenBalance: (balance) => set({ userSourceTokenBalance: balance }),
      clearBalances: () => set({ userSOLBalance: undefined, userSourceTokenBalance: undefined }),

      // Quote Actions (clear success when user picks a different quote)
      setParams: (params) => set({ params }),
      setSelectedQuote: (quote) => set({ selectedQuote: quote, executeSuccess: null }),
      setParamsLastChangedAt: (timestamp) => set({ paramsLastChangedAt: timestamp }),
      clearQuoteState: () =>
        set({
          params: null,
          selectedQuote: null,
          paramsLastChangedAt: null,
        }),

      // Execution Actions
      setExecuting: (executing) => set({ executing }),
      setExecuteError: (error) => set({ executeError: error }),
      setExecuteSuccess: (success) =>
        set((s) => ({
          executeSuccess: success,
          ...(success != null
            ? {
                amount: "",
                userSourceTokenBalance: undefined,
                userSOLBalance: undefined,
                balanceInvalidationCounter: s.balanceInvalidationCounter + 1,
              }
            : {}),
        })),
      clearExecutionState: () =>
        set({
          executing: false,
          executeError: null,
          executeSuccess: null,
        }),

      // Price Actions
      setPrices: (prices) => set({ prices }),
      setSolPrice: (price) =>
        set((state) => ({
          prices: { ...state.prices, sol: price },
        })),
      setTokenPrice: (currency, price) =>
        set((state) => ({
          prices: { ...state.prices, [currency]: price },
        })),

      // Timing Actions
      updateNow: () => set({ now: Date.now() }),

      // Reset Actions
      resetForm: () =>
        set({
          originToken: getInitialOriginToken(),
          amount: "",
          destinationChainId: 8453,
          destinationToken: getInitialDestinationToken(8453),
          destinationAddressOverride: "",
          evmAddressError: null,
        }),
      resetAll: () => set({ ...initialState }),
    }),
    {
      name: "swap-store",
      // Only persist form state, not sensitive or transient state
      partialize: (state) => ({
        originToken: state.originToken,
        amount: state.amount,
        destinationChainId: state.destinationChainId,
        destinationToken: state.destinationToken,
        evmDefaultWalletHintDismissed: state.evmDefaultWalletHintDismissed,
      }),
    }
  )
);

// ============================================================================
// Computed Selectors (Helper Functions)
// ============================================================================

/**
 * Compute swap parameters from form state.
 * Returns null if form is incomplete or invalid.
 */
export function computeSwapParams(
  state: SwapStoreState,
  publicKey: string | null | undefined,
  rawAmount: string
): SwapParams | null {
  if (!publicKey || !state.originToken || !state.destinationToken || !rawAmount || rawAmount === "0") {
    return null;
  }

  const destIsEvm = isEvmChain(state.destinationChainId);
  const evmAddressValid = !destIsEvm || isValidEvmAddress(state.destinationAddressOverride);

  if (destIsEvm && !evmAddressValid) {
    return null;
  }

  const recipientAddress = destIsEvm && evmAddressValid && state.destinationAddressOverride
    ? state.destinationAddressOverride.trim()
    : publicKey;

  return {
    originChainId: CHAIN_ID_SOLANA,
    originToken: state.originToken,
    amount: rawAmount,
    destinationChainId: state.destinationChainId,
    destinationToken: state.destinationToken,
    userAddress: publicKey,
    recipientAddress,
    tradeType: "exact_in" as const,
    // NOTE: Fee Sponsorship Requirements
    // Relay fee sponsorship (covering destination chain fees) requires Enterprise Partnership.
    // Enterprise Partnership includes: Fee Sponsorship, Sponsored Execution, Fast Fill,
    // Custom SLAs, Priority Support, Increased Rate Limits, Revenue Share.
    //
    // Until Enterprise Partnership is obtained:
    // - Users pay their own Solana transaction fees (depositFeePayer set to user address)
    // - No `subsidizeFees` or `subsidizeRent` parameters can be used
    //
    // Once Enterprise Partnership is obtained:
    // - Set `depositFeePayer` to sponsor address or remove to use DEFAULT_DEPOSIT_FEE_PAYER
    // - Add `subsidizeFees: true` and optionally `subsidizeRent: true` to quote requests
    // - Add `x-api-key` header with Enterprise API key
    //
    // See: https://docs.relay.link/features/fee-sponsorship
    depositFeePayer: publicKey, // User pays fees until Enterprise Partnership obtained
  };
}

/**
 * Compute recipient address based on destination chain and form state.
 */
export function computeRecipientAddress(
  state: SwapStoreState,
  publicKey: string | null | undefined
): string {
  if (!publicKey) return "";
  const destIsEvm = isEvmChain(state.destinationChainId);
  const evmAddressValid = !destIsEvm || isValidEvmAddress(state.destinationAddressOverride);
  if (destIsEvm && evmAddressValid && state.destinationAddressOverride) {
    return state.destinationAddressOverride.trim();
  }
  return publicKey;
}

/**
 * Check if EVM address is valid.
 */
export function computeEvmAddressValid(state: SwapStoreState): boolean {
  const destIsEvm = isEvmChain(state.destinationChainId);
  if (!destIsEvm) return true;
  return isValidEvmAddress(state.destinationAddressOverride);
}
