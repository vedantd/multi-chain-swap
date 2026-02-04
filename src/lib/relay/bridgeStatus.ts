/**
 * Relay Bridge Status Monitoring
 *
 * Monitors bridge status using Relay's /intents/status endpoint (relayapi.md
 * step check.endpoint example uses /intents/status?requestId=...). If the API
 * returns 404, Relay may have moved to /intents/status/v3—update the path and
 * env if needed.
 *
 * Tracks the full bridge lifecycle: waiting -> pending -> success/failure/refund
 *
 * Based on Relay documentation:
 * https://docs.relay.link/bridging-integration-guide#monitor-bridge-status
 */

export type RelayBridgeStatus = "waiting" | "pending" | "success" | "failure" | "refund";

export interface RelayBridgeStatusResponse {
  status: RelayBridgeStatus;
  inTxHashes?: string[]; // Origin chain transaction hashes
  txHashes?: string[]; // Destination chain transaction hashes
  time?: number; // Timestamp
  originChainId?: number;
  destinationChainId?: number;
  error?: string;
}

/** Raw API response may use inTxs/outTxs (array of { hash?: string }) instead of inTxHashes/txHashes. */
interface RelayStatusRawResponse {
  status?: RelayBridgeStatus;
  inTxHashes?: string[];
  txHashes?: string[];
  inTxs?: Array<{ hash?: string }>;
  outTxs?: Array<{ hash?: string }>;
  time?: number;
  originChainId?: number;
  destinationChainId?: number;
  error?: string;
}

/**
 * Normalize status response: Relay API may return inTxs/outTxs (objects with hash) or inTxHashes/txHashes (string arrays).
 * We always expose inTxHashes and txHashes to the rest of the app.
 */
function normalizeBridgeStatusResponse(raw: RelayStatusRawResponse): RelayBridgeStatusResponse {
  const inTxHashes =
    raw.inTxHashes ??
    (Array.isArray(raw.inTxs) ? raw.inTxs.map((t) => t.hash).filter((h): h is string => typeof h === "string") : undefined);
  const txHashes =
    raw.txHashes ??
    (Array.isArray(raw.outTxs) ? raw.outTxs.map((t) => t.hash).filter((h): h is string => typeof h === "string") : undefined);
  return {
    status: raw.status ?? "pending",
    inTxHashes,
    txHashes,
    time: raw.time,
    originChainId: raw.originChainId,
    destinationChainId: raw.destinationChainId,
    error: raw.error,
  };
}

/**
 * Check bridge status using Relay's /intents/status endpoint.
 *
 * @param requestId - Relay requestId from the quote response
 * @returns Bridge status response (normalized to inTxHashes/txHashes)
 */
export async function checkRelayBridgeStatus(
  requestId: string
): Promise<RelayBridgeStatusResponse> {
  const baseUrl = process.env.RELAY_API_URL ?? "https://api.relay.link";
  const url = `${baseUrl.replace(/\/$/, "")}/intents/status?requestId=${encodeURIComponent(requestId)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[bridgeStatus] Failed to check status:", res.status, text);
      throw new Error(`Failed to check bridge status: ${res.status}`);
    }

    const data = (await res.json()) as RelayStatusRawResponse;
    return normalizeBridgeStatusResponse(data);
  } catch (error) {
    console.error("[bridgeStatus] Error checking bridge status:", error);
    throw error;
  }
}

/**
 * Poll bridge status until completion or failure.
 * 
 * @param requestId - Relay requestId from the quote response
 * @param maxAttempts - Maximum number of polling attempts (default: 60)
 * @param pollIntervalMs - Interval between polls in milliseconds (default: 3000)
 * @returns Final bridge status response
 */
export async function pollRelayBridgeStatus(
  requestId: string,
  maxAttempts: number = 60,
  pollIntervalMs: number = 3000
): Promise<RelayBridgeStatusResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const status = await checkRelayBridgeStatus(requestId);

      // Terminal states - stop polling
      if (
        status.status === "success" ||
        status.status === "failure" ||
        status.status === "refund"
      ) {
        return status;
      }

      // Continue polling for waiting/pending states
      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    } catch (error) {
      // On error, continue polling (might be temporary network issue)
      console.warn(`[bridgeStatus] Error polling bridge status (attempt ${i + 1}/${maxAttempts}):`, error);
      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }
  }

  // Timeout - return last known status or failure
  try {
    return await checkRelayBridgeStatus(requestId);
  } catch {
    return {
      status: "failure",
      error: "Bridge status polling timeout - could not determine final status",
    };
  }
}

/**
 * Map Relay bridge status to our swap transaction status.
 */
export function mapRelayStatusToSwapStatus(
  relayStatus: RelayBridgeStatus
): "pending" | "confirmed" | "finalized" | "failed" | "completed" {
  switch (relayStatus) {
    case "waiting":
    case "pending":
      return "pending";
    case "success":
      return "completed";
    case "failure":
    case "refund":
      return "failed";
    default:
      return "pending";
  }
}
