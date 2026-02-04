"use client";

import { useCallback, useEffect, useRef } from "react";
import { isValidEvmAddress } from "@/lib/utils/address";
import { getEthereumProviderForWallet, requestEvmAccounts } from "@/lib/wallet/evmProvider";

const FETCH_TIMEOUT_MS = 10_000;
const WALLET_CHANGE_SKIP_MS = 300;
const FETCH_DELAY_MS = 0;
const METAMASK_PROVIDER_DELAY_MS = 150;

export interface UseEvmAddressParams {
  walletName: string | undefined;
  destIsEvm: boolean;
  destinationAddressOverride: string;
  evmAddressValid: boolean;
  setDestinationAddressOverride: (address: string) => void;
  setEvmAddressError: (error: string | null) => void;
  setEvmAddressFetching: (fetching: boolean) => void;
  /** Ref set by parent when destination was just cleared due to wallet change; skip auto-fetch for a short window. */
  walletChangeClearedAtRef: React.MutableRefObject<number | null>;
}

export function useEvmAddress({
  walletName,
  destIsEvm,
  destinationAddressOverride,
  evmAddressValid,
  setDestinationAddressOverride,
  setEvmAddressError,
  setEvmAddressFetching,
  walletChangeClearedAtRef,
}: UseEvmAddressParams) {
  const fetchingRef = useRef(false);

  const fetchEvmAddress = useCallback(async (overrideWalletName?: string) => {
    if (typeof window === "undefined") return;
    if (fetchingRef.current) return;

    const effectiveWalletName = overrideWalletName ?? walletName ?? "";
    fetchingRef.current = true;
    setEvmAddressFetching(true);
    setEvmAddressError(null);

    const result = getEthereumProviderForWallet(effectiveWalletName);
    const timeoutId = setTimeout(() => {
      console.warn("[EVM] fetchEvmAddress timed out");
      setEvmAddressError("Request timed out. Please try again or enter address manually.");
      fetchingRef.current = false;
      setEvmAddressFetching(false);
    }, FETCH_TIMEOUT_MS);

    try {
      if (!result?.provider) {
        clearTimeout(timeoutId);
        console.error("[EVM] no provider for wallet", effectiveWalletName);
        const isMetaMask = (effectiveWalletName ?? "").toLowerCase().includes("metamask");
        setEvmAddressError(
          isMetaMask
            ? "MetaMask's Ethereum provider not available (Phantom may have taken over). Use “Refetch destination address” after selecting MetaMask, or enter your EVM address manually."
            : "No Ethereum provider found. Install MetaMask or enable EVM in Phantom."
        );
        fetchingRef.current = false;
        setEvmAddressFetching(false);
        return;
      }

      const { provider, source } = result;
      const accounts = await requestEvmAccounts(provider, FETCH_TIMEOUT_MS);
      clearTimeout(timeoutId);

      const first = accounts[0];
      if (typeof first === "string" && isValidEvmAddress(first)) {
        console.log("[EVM] destination address auto-picked (fetch)", { walletName: effectiveWalletName || "unknown", source, evmAddress: first });
        setDestinationAddressOverride(first);
        setEvmAddressError(null);
      } else if (accounts.length === 0) {
        setEvmAddressError("No accounts found. Connect your EVM wallet or enter address manually.");
      } else {
        setEvmAddressError("Invalid address from wallet.");
        console.warn("[EVM] invalid first account", first);
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const msg = err instanceof Error ? err.message : "Failed to fetch EVM address";
      console.error("[EVM] fetchEvmAddress error", err);
      if (!/reject|denied|User rejected/i.test(msg)) {
        setEvmAddressError(`Failed to connect: ${msg}`);
      }
    } finally {
      fetchingRef.current = false;
      setEvmAddressFetching(false);
    }
  }, [
    walletName,
    setEvmAddressFetching,
    setEvmAddressError,
    setDestinationAddressOverride,
  ]);

  // Fetch EVM address as soon as destination is EVM and we don't have a valid address yet.
  // Only run when we have a known wallet name; otherwise we'd use getEthereumProviderForWallet("") and get Phantom when both are installed.
  // On first connect (e.g. after clearing cookies) SwapPanel's wallet-change effect does the fetch with the correct wallet name.
  useEffect(() => {
    const clearedAt = walletChangeClearedAtRef.current;
    const skipDueToWalletChange = clearedAt != null && Date.now() - clearedAt < WALLET_CHANGE_SKIP_MS;
    if (!destIsEvm) return;
    if (!walletName?.trim()) return;
    if (fetchingRef.current) return;
    if (destinationAddressOverride && evmAddressValid) return;
    if (skipDueToWalletChange) return;

    const isMetaMask = (walletName ?? "").toLowerCase().includes("metamask");
    const delayMs = isMetaMask ? METAMASK_PROVIDER_DELAY_MS : FETCH_DELAY_MS;
    if (delayMs <= 0) {
      fetchEvmAddress();
      return;
    }
    const timer = setTimeout(() => fetchEvmAddress(), delayMs);
    return () => clearTimeout(timer);
  }, [destIsEvm, walletName, destinationAddressOverride, evmAddressValid, fetchEvmAddress, walletChangeClearedAtRef]);

  // Listen for EVM account changes on the provider that matches the connected Solana wallet.
  useEffect(() => {
    if (!destIsEvm || typeof window === "undefined") return;

    const win = window as unknown as {
      ethereum?: { on?: (event: string, handler: (accounts: unknown) => void) => void; removeListener?: (event: string, handler: (accounts: unknown) => void) => void };
      phantom?: { ethereum?: { on?: (event: string, handler: (accounts: unknown) => void) => void; removeListener?: (event: string, handler: (accounts: unknown) => void) => void } };
    };
    const name = (walletName ?? "").toLowerCase();
    const ethereum =
      name.includes("phantom") && win.phantom?.ethereum
        ? win.phantom.ethereum
        : win.ethereum ?? win.phantom?.ethereum;

    if (!ethereum?.on) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const arr = Array.isArray(accounts) ? accounts : [];
      const first = arr[0];
      if (typeof first === "string" && isValidEvmAddress(first)) {
        console.log("[EVM] destination address auto-picked (accountsChanged)", { walletName: (walletName ?? "").toLowerCase().includes("phantom") ? "Phantom" : "MetaMask", evmAddress: first });
        setDestinationAddressOverride(first);
        setEvmAddressError(null);
      } else {
        console.log("[EVM] destination address cleared (accountsChanged)", { walletName: walletName ?? "unknown", reason: arr.length === 0 ? "no accounts" : "invalid first account" });
        setDestinationAddressOverride("");
      }
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      if (ethereum?.removeListener) {
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, [destIsEvm, walletName, setDestinationAddressOverride, setEvmAddressError]);

  return { fetchEvmAddress };
}
