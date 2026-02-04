import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkRelayBridgeStatus,
  mapRelayStatusToSwapStatus,
  type RelayBridgeStatus,
} from "./bridgeStatus";

describe("mapRelayStatusToSwapStatus", () => {
  it("maps waiting and pending to pending", () => {
    expect(mapRelayStatusToSwapStatus("waiting")).toBe("pending");
    expect(mapRelayStatusToSwapStatus("pending")).toBe("pending");
  });

  it("maps success to completed", () => {
    expect(mapRelayStatusToSwapStatus("success")).toBe("completed");
  });

  it("maps failure and refund to failed", () => {
    expect(mapRelayStatusToSwapStatus("failure")).toBe("failed");
    expect(mapRelayStatusToSwapStatus("refund")).toBe("failed");
  });

  it("maps unknown status to pending", () => {
    expect(mapRelayStatusToSwapStatus("unknown" as RelayBridgeStatus)).toBe("pending");
  });
});

describe("checkRelayBridgeStatus", () => {
  const requestId = "0x92b99e6e1ee1deeb9531b5ad7f87091b3d71254b3176de9e8b5f6c6d0bd3a331";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls /intents/status with requestId (no v3)", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success" }),
    } as Response);

    await checkRelayBridgeStatus(requestId);

    expect(fetch).toHaveBeenCalledTimes(1);
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = call != null ? call[0] : undefined;
    expect(url).toContain("/intents/status?");
    expect(url).toContain(encodeURIComponent(requestId));
    expect(url).not.toContain("/intents/status/v3");
  });

  it("returns normalized response when API returns inTxHashes/txHashes", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "success",
        inTxHashes: ["origin_tx_1"],
        txHashes: ["dest_tx_1"],
      }),
    } as Response);

    const result = await checkRelayBridgeStatus(requestId);

    expect(result.status).toBe("success");
    expect(result.inTxHashes).toEqual(["origin_tx_1"]);
    expect(result.txHashes).toEqual(["dest_tx_1"]);
  });

  it("normalizes inTxs/outTxs to inTxHashes/txHashes", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "success",
        inTxs: [{ hash: "origin_hash_1" }, { hash: "origin_hash_2" }],
        outTxs: [{ hash: "dest_hash_1" }],
      }),
    } as Response);

    const result = await checkRelayBridgeStatus(requestId);

    expect(result.status).toBe("success");
    expect(result.inTxHashes).toEqual(["origin_hash_1", "origin_hash_2"]);
    expect(result.txHashes).toEqual(["dest_hash_1"]);
  });

  it("filters out inTxs/outTxs entries without hash", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "pending",
        inTxs: [{ hash: "a" }, {}, { hash: "c" }],
        outTxs: [{}, { hash: "dest" }],
      }),
    } as Response);

    const result = await checkRelayBridgeStatus(requestId);

    expect(result.inTxHashes).toEqual(["a", "c"]);
    expect(result.txHashes).toEqual(["dest"]);
  });

  it("throws when response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    } as Response);

    await expect(checkRelayBridgeStatus(requestId)).rejects.toThrow(
      "Failed to check bridge status: 500"
    );
  });
});
