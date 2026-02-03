"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import {
  CHAIN_ID_SOLANA,
  DESTINATION_CHAIN_IDS,
  formatRawAmount,
  getChainName,
  humanAmountToRaw,
  isEvmChain,
  TOKENS_BY_CHAIN,
} from "@/lib/chainConfig";
import type { NormalizedQuote, SwapParams } from "@/types/swap";
import { useQuotes } from "@/hooks/useQuotes";

const ORIGIN_CHAIN_ID = CHAIN_ID_SOLANA;

export function SwapPanel() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [originToken, setOriginToken] = useState("");
  const [amount, setAmount] = useState("");
  const [destinationChainId, setDestinationChainId] = useState(8453);
  const [destinationToken, setDestinationToken] = useState("");
  const [destinationAddressOverride, setDestinationAddressOverride] = useState("");
  const [evmAddressFetching, setEvmAddressFetching] = useState(false);
  const fetchEvmAddress = useCallback(() => {
    if (typeof window === "undefined") return;
    const ethereum = (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<unknown[]> } }).ethereum;
    if (!ethereum?.request) return;
    setEvmAddressFetching(true);
    ethereum
      .request({ method: "eth_requestAccounts" })
      .then((accounts: unknown) => {
        const first = Array.isArray(accounts) ? accounts[0] : null;
        if (typeof first === "string" && first.startsWith("0x") && first.length === 42) {
          setDestinationAddressOverride(first);
        }
      })
      .catch(() => {})
      .finally(() => setEvmAddressFetching(false));
  }, []);
  const [params, setParams] = useState<SwapParams | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<NormalizedQuote | null>(
    null
  );
  const [executing, setExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [executeSuccess, setExecuteSuccess] = useState<string | null>(null);

  const originTokens = useMemo(
    () => TOKENS_BY_CHAIN[ORIGIN_CHAIN_ID] ?? [],
    []
  );
  const destinationTokens = useMemo(
    () => TOKENS_BY_CHAIN[destinationChainId] ?? [],
    [destinationChainId]
  );

  useEffect(() => {
    if (originTokens.length === 0) return;
    const validAddresses = new Set(originTokens.map((t) => t.address));
    if (!originToken || !validAddresses.has(originToken)) {
      setOriginToken(originTokens[0].address);
    }
  }, [originTokens, originToken]);

  useEffect(() => {
    if (destinationTokens.length === 0) return;
    const validAddresses = new Set(destinationTokens.map((t) => t.address));
    if (!destinationToken || !validAddresses.has(destinationToken)) {
      setDestinationToken(destinationTokens[0].address);
    }
  }, [destinationChainId, destinationTokens, destinationToken]);

  const selectedOriginToken = useMemo(
    () => originTokens.find((t) => t.address === originToken) ?? originTokens[0],
    [originTokens, originToken]
  );
  const originDecimals = selectedOriginToken?.decimals ?? 6;

  const rawAmount = useMemo(() => {
    if (!amount.trim()) return "0";
    return humanAmountToRaw(amount.trim(), originDecimals);
  }, [amount, originDecimals]);

  const destIsEvm = isEvmChain(destinationChainId);
  const evmAddressValid =
    !destIsEvm ||
    (destinationAddressOverride.startsWith("0x") &&
      destinationAddressOverride.length === 42);

  const recipientAddress = useMemo(() => {
    if (!publicKey) return "";
    if (destIsEvm && evmAddressValid && destinationAddressOverride) {
      return destinationAddressOverride.trim();
    }
    return publicKey.toBase58();
  }, [publicKey, destIsEvm, evmAddressValid, destinationAddressOverride]);

  useEffect(() => {
    if (!destIsEvm || !publicKey) return;
    if (destinationAddressOverride && evmAddressValid) return;
    fetchEvmAddress();
  }, [destIsEvm, publicKey]);

  const swapParams: SwapParams | null = useMemo(
    () =>
      publicKey &&
      originToken &&
      destinationToken &&
      rawAmount &&
      rawAmount !== "0" &&
      (!destIsEvm || evmAddressValid)
        ? {
            originChainId: ORIGIN_CHAIN_ID,
            originToken,
            amount: rawAmount,
            destinationChainId,
            destinationToken,
            userAddress: publicKey.toBase58(),
            recipientAddress,
            tradeType: "exact_in" as const,
            depositFeePayer: publicKey.toBase58(),
          }
        : null,
    [
      publicKey,
      originToken,
      rawAmount,
      destinationChainId,
      destinationToken,
      destIsEvm,
      evmAddressValid,
      recipientAddress,
    ]
  );

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuotes(params ?? null);

  const triggerQuote = useCallback(() => {
    if (swapParams) {
      const destAddress = swapParams.recipientAddress ?? swapParams.userAddress;
      console.log("[SwapPanel] Get quote – destination address from wallet:", destAddress, "originChain:", swapParams.originChainId, "destChain:", swapParams.destinationChainId);
      setParams(swapParams);
      setSelectedQuote(null);
    }
  }, [swapParams]);

  const best = data?.best ?? null;
  const quotes = data?.quotes ?? [];
  const isExpired =
    best != null && Date.now() >= best.expiryAt;
  const canExecute =
    selectedQuote != null && !executing && !isExpired;

  const handleExecute = useCallback(async () => {
    if (!selectedQuote || !canExecute || !sendTransaction || !connection) return;
    setExecuting(true);
    setExecuteError(null);
    setExecuteSuccess(null);
    try {
      const raw = selectedQuote.raw as Record<string, unknown>;
      if (selectedQuote.provider === "debridge" && raw?.tx) {
        const tx = raw.tx as Record<string, unknown>;
        if (typeof window !== "undefined" && (window as unknown as { ethereum?: { request: (args: unknown) => Promise<unknown> } }).ethereum?.request) {
          const hash = await (window as unknown as { ethereum: { request: (args: unknown) => Promise<unknown> } }).ethereum.request({
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
          console.log("deBridge tx sent:", hash);
        } else {
          setExecuteError("EVM wallet required for deBridge execution. Raw tx logged to console.");
          console.log("deBridge raw tx (EVM):", raw.tx);
        }
      } else if (selectedQuote.provider === "relay" && raw?.steps) {
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
            const sig = await sendTransaction(tx, connection, { skipPreflight: false });
            console.log("Relay Solana tx sent:", sig);
            setExecuteSuccess(`Sent. View: https://explorer.solana.com/tx/${sig}`);
          } catch (err) {
            console.error("Relay Solana send failed:", err);
            setExecuteError(err instanceof Error ? err.message : "Failed to send Solana transaction");
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
      setExecuteError(e instanceof Error ? e.message : "Execution failed");
    } finally {
      setExecuting(false);
    }
  }, [selectedQuote, canExecute, connection, sendTransaction]);

  useEffect(() => {
    if (best && !selectedQuote) setSelectedQuote(best);
  }, [best, selectedQuote]);

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "1.25rem",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
          Cross-chain swap
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground, #666)", marginBottom: "0.25rem" }}>
            From Solana (your connected wallet)
          </p>
          <div>
            <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.25rem" }}>Token on Solana</label>
            <select
              value={originToken}
              onChange={(e) => setOriginToken(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px" }}
            >
              {originTokens.map((t) => (
                <option key={t.address} value={t.address}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.25rem" }}>
              Amount ({selectedOriginToken?.symbol ?? "token"}) — enter in full units
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
              }}
              placeholder={selectedOriginToken?.symbol === "USDC" ? "e.g. 10 (min ~10 for cross-chain)" : "e.g. 10"}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", boxSizing: "border-box" }}
            />
            {selectedOriginToken && amount.trim() && rawAmount !== "0" && (
              <p style={{ fontSize: "0.7rem", color: "var(--muted-foreground, #666)", marginTop: "0.25rem" }}>
                = {rawAmount} raw units (min ~10 {selectedOriginToken?.symbol} for cross-chain)
              </p>
            )}
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.25rem" }}>Destination chain</label>
            <select
              value={destinationChainId}
              onChange={(e) => setDestinationChainId(Number(e.target.value))}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px" }}
            >
              {DESTINATION_CHAIN_IDS.map((id) => (
                <option key={id} value={id}>
                  {getChainName(id)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.25rem" }}>Destination token</label>
            <select
              value={destinationToken}
              onChange={(e) => setDestinationToken(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px" }}
            >
              {destinationTokens.map((t) => (
                <option key={t.address} value={t.address}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
          {destIsEvm && (
            <div>
              <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.25rem" }}>
                Destination address (EVM) — from MetaMask/Phantom when available
              </label>
              <input
                type="text"
                value={destinationAddressOverride}
                onChange={(e) => setDestinationAddressOverride(e.target.value)}
                placeholder={evmAddressFetching ? "Fetching your EVM address…" : "0x… or connect wallet above"}
                disabled={evmAddressFetching}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  boxSizing: "border-box",
                  fontFamily: "monospace",
                }}
              />
              {!evmAddressValid && (
                <button
                  type="button"
                  onClick={fetchEvmAddress}
                  disabled={evmAddressFetching}
                  style={{
                    marginTop: "0.35rem",
                    padding: "0.35rem 0.6rem",
                    fontSize: "0.75rem",
                    borderRadius: "4px",
                    cursor: evmAddressFetching ? "not-allowed" : "pointer",
                  }}
                >
                  {evmAddressFetching ? "Connecting…" : "Use my EVM address (MetaMask/Phantom)"}
                </button>
              )}
              {evmAddressFetching && (
                <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground, #666)", marginTop: "0.25rem" }}>
                  Approve in your wallet to use your EVM address
                </p>
              )}
              {destIsEvm && destinationAddressOverride && !evmAddressValid && (
                <p style={{ fontSize: "0.75rem", color: "var(--destructive)", marginTop: "0.25rem" }}>
                  Enter a valid EVM address (0x + 40 hex chars)
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={triggerQuote}
            disabled={!swapParams || isFetching}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: swapParams && !isFetching ? "pointer" : "not-allowed",
              opacity: swapParams && !isFetching ? 1 : 0.6,
            }}
          >
            {isFetching ? "Fetching…" : "Get quote"}
          </button>
        </div>
      </section>

      {params != null && (
        <section
          style={{
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "1.25rem",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
            Quote
          </h2>
          {isLoading && <p style={{ fontSize: "0.875rem" }}>Loading quotes…</p>}
          {isError && (
            <p style={{ fontSize: "0.875rem", color: "var(--destructive)" }}>
              {error?.message ?? "Failed to load quotes"}
            </p>
          )}
          {data && best && !isLoading && (
            <>
              {isExpired ? (
                <p style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                  Quote expired, refetch quote
                </p>
              ) : (
                <div style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                  {(() => {
                    const q = selectedQuote ?? best;
                    if (!q) return null;
                    const solanaNetworkLine =
                      q.solanaCostToUser && q.solanaCostToUser !== "0"
                        ? ` + ~${formatRawAmount(q.solanaCostToUser, "SOL")} SOL (network)`
                        : "";
                    return (
                      <>
                        <p>You receive: {q.expectedOutFormatted} {q.feeCurrency} (provider: {q.provider})</p>
                        <p>
                          {q.feePayer === "sponsor"
                            ? `Fees: ${formatRawAmount(q.fees, q.feeCurrency)} ${q.feeCurrency} (sponsored)`
                            : `You pay: ${formatRawAmount(q.fees, q.feeCurrency)} ${q.feeCurrency}${solanaNetworkLine}`}
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  style={{
                    padding: "0.4rem 0.75rem",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    cursor: isFetching ? "not-allowed" : "pointer",
                  }}
                >
                  Refetch quote
                </button>
                {quotes.length > 1 && (
                  <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                    {quotes.map((q) => (
                      <button
                        key={q.provider}
                        type="button"
                        onClick={() => setSelectedQuote(q)}
                        style={{
                          padding: "0.4rem 0.75rem",
                          borderRadius: "6px",
                          fontSize: "0.875rem",
                          cursor: "pointer",
                          border: selectedQuote?.provider === q.provider ? "2px solid var(--primary)" : "1px solid var(--border)",
                        }}
                      >
                        {q.provider}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={!canExecute}
                  style={{
                    padding: "0.4rem 0.75rem",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: canExecute ? "pointer" : "not-allowed",
                    opacity: canExecute ? 1 : 0.6,
                  }}
                >
                  {executing ? "Executing…" : "Execute"}
                </button>
              </div>
              {executeSuccess && (
                <p style={{ fontSize: "0.875rem", color: "var(--success, green)", marginTop: "0.5rem" }}>
                  {executeSuccess}
                </p>
              )}
              {executeError && (
                <p style={{ fontSize: "0.875rem", color: "var(--destructive)", marginTop: "0.5rem" }}>
                  {executeError}
                </p>
              )}
            </>
          )}
          {params != null && !data && !isLoading && !isError && (
            <p style={{ fontSize: "0.875rem" }}>Click “Get quote” to fetch.</p>
          )}
        </section>
      )}
    </div>
  );
}
