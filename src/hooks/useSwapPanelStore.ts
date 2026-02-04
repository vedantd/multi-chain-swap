/**
 * Single hook for SwapPanel to access all swap store state and actions.
 * Uses a single selector with shallow compare to avoid 30+ separate subscriptions.
 */

import { useShallow } from "zustand/react/shallow";
import { useSwapStore } from "@/stores/swapStore";

export function useSwapPanelStore() {
  return useSwapStore(
    useShallow((state) => ({
      // Form state
      originToken: state.originToken,
      amount: state.amount,
      destinationChainId: state.destinationChainId,
      destinationToken: state.destinationToken,
      destinationAddressOverride: state.destinationAddressOverride,
      // UI state
      evmAddressFetching: state.evmAddressFetching,
      evmAddressError: state.evmAddressError,
      evmDefaultWalletHintDismissed: state.evmDefaultWalletHintDismissed,
      // Balance state
      userSOLBalance: state.userSOLBalance,
      userSourceTokenBalance: state.userSourceTokenBalance,
      // Quote state
      params: state.params,
      selectedQuote: state.selectedQuote,
      paramsLastChangedAt: state.paramsLastChangedAt,
      // Execution state
      executing: state.executing,
      executeError: state.executeError,
      executeSuccess: state.executeSuccess,
      balanceInvalidationCounter: state.balanceInvalidationCounter,
      // Price state
      prices: state.prices,
      // Timing state
      now: state.now,
      // Actions
      setOriginToken: state.setOriginToken,
      setAmount: state.setAmount,
      setDestinationChainId: state.setDestinationChainId,
      setDestinationToken: state.setDestinationToken,
      setDestinationAddressOverride: state.setDestinationAddressOverride,
      setEvmAddressFetching: state.setEvmAddressFetching,
      setEvmAddressError: state.setEvmAddressError,
      setEvmDefaultWalletHintDismissed: state.setEvmDefaultWalletHintDismissed,
      setUserSOLBalance: state.setUserSOLBalance,
      setUserSourceTokenBalance: state.setUserSourceTokenBalance,
      setParams: state.setParams,
      setSelectedQuote: state.setSelectedQuote,
      setExecuting: state.setExecuting,
      setExecuteError: state.setExecuteError,
      setExecuteSuccess: state.setExecuteSuccess,
      setParamsLastChangedAt: state.setParamsLastChangedAt,
      setPrices: state.setPrices,
      updateNow: state.updateNow,
      clearBalances: state.clearBalances,
      resetForm: state.resetForm,
      clearQuoteState: state.clearQuoteState,
      clearExecutionState: state.clearExecutionState,
    }))
  );
}
