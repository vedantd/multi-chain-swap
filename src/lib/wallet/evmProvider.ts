/**
 * EVM provider resolution for multi-wallet (Phantom vs MetaMask).
 * When both are installed, window.ethereum is often overwritten by Phantom;
 * we resolve the provider that matches the connected Solana wallet.
 */

export interface EthereumProvider {
  request: (args: { method: string }) => Promise<unknown>;
}

export interface WindowWithEthereum {
  ethereum?: {
    request: (args: { method: string }) => Promise<unknown>;
    isMetaMask?: boolean;
    isPhantom?: boolean;
    providers?: unknown[];
  };
  phantom?: {
    ethereum?: {
      request: (args: { method: string }) => Promise<unknown>;
      isPhantom?: boolean;
    };
  };
}

export interface GetProviderResult {
  provider: EthereumProvider;
  source: string;
}

/**
 * Get the Ethereum provider that matches the connected Solana wallet name.
 * Use window.phantom.ethereum for Phantom; for MetaMask use providers[] or window.ethereum.
 */
export function getEthereumProviderForWallet(walletName: string): GetProviderResult | null {
  if (typeof window === "undefined") return null;

  const win = window as unknown as WindowWithEthereum;
  const connectedWalletName = (walletName ?? "").toLowerCase();
  const hasPhantomEthereum = !!win.phantom?.ethereum;
  const hasStandardEthereum = !!win.ethereum;
  const standardIsPhantom = !!(win.ethereum as { isPhantom?: boolean } | undefined)?.isPhantom;
  const standardIsMetaMask = !!(win.ethereum as { isMetaMask?: boolean } | undefined)?.isMetaMask;
  const providersArray = win.ethereum?.providers;
  const hasProvidersArray = Array.isArray(providersArray) && providersArray.length > 0;
  const metamaskFromProviders = hasProvidersArray
    ? (providersArray as Array<{ isMetaMask?: boolean; isPhantom?: boolean; request?: (args: { method: string }) => Promise<unknown> }>).find(
        (p) => p?.isMetaMask && !p.isPhantom
      )
    : undefined;
  const phantomFromProviders = hasProvidersArray
    ? (providersArray as Array<{ isPhantom?: boolean; request?: (args: { method: string }) => Promise<unknown> }>).find((p) => p?.isPhantom)
    : undefined;

  if (connectedWalletName.includes("phantom") && hasPhantomEthereum) {
    return { provider: win.phantom!.ethereum! as EthereumProvider, source: "phantom.ethereum (Solana wallet is Phantom)" };
  }
  if (connectedWalletName.includes("metamask") && (hasStandardEthereum || metamaskFromProviders)) {
    // Prefer MetaMask from providers[] so we never use window.ethereum when it's actually Phantom (e.g. on first load isPhantom can be unset).
    if (metamaskFromProviders?.request) {
      const source =
        standardIsPhantom
          ? "window.ethereum.providers[MetaMask] (window.ethereum was Phantom)"
          : "window.ethereum.providers[MetaMask]";
      return { provider: metamaskFromProviders as EthereumProvider, source };
    }
    if (!standardIsPhantom && hasStandardEthereum) {
      return { provider: win.ethereum! as EthereumProvider, source: "window.ethereum (Solana wallet is MetaMask)" };
    }
    if (standardIsPhantom) {
      console.warn("[EVM] MetaMask requested but window.ethereum is Phantom and no providers[]; refusing to use Phantom address for MetaMask");
      return null;
    }
    return { provider: win.ethereum! as EthereumProvider, source: "window.ethereum (fallback)" };
  }
  if (hasStandardEthereum) {
    return { provider: win.ethereum! as EthereumProvider, source: `window.ethereum (fallback; connectedWalletName="${connectedWalletName}")` };
  }
  if (hasPhantomEthereum) {
    return { provider: win.phantom!.ethereum! as EthereumProvider, source: "phantom.ethereum (fallback)" };
  }
  return null;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Request EVM accounts from the provider with a timeout.
 * Returns an array of account addresses (0x...).
 */
export async function requestEvmAccounts(
  provider: EthereumProvider,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<string[]> {
  if (!provider?.request) {
    throw new Error("No Ethereum provider request method");
  }
  const requested = await Promise.race([
    provider.request({ method: "eth_requestAccounts" }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("eth_requestAccounts timeout")), timeoutMs)
    ),
  ]);
  const arr = Array.isArray(requested) ? requested : [];
  return arr.filter((a): a is string => typeof a === "string");
}
