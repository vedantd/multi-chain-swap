/**
 * Relay Bridge Status Monitoring
 * 
 * Monitors bridge status using Relay's /intents/status endpoint.
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

/**
 * Check bridge status using Relay's /intents/status endpoint.
 * 
 * @param requestId - Relay requestId from the quote response
 * @returns Bridge status response
 */
export async function checkRelayBridgeStatus(
  requestId: string
): Promise<RelayBridgeStatusResponse> {
  const baseUrl = process.env.RELAY_API_URL ?? "https://api.relay.link";
  const url = `${baseUrl.replace(/\/$/, "")}/intents/status/v3?requestId=${encodeURIComponent(requestId)}`;

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

    const data = (await res.json()) as RelayBridgeStatusResponse;
    return data;
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
