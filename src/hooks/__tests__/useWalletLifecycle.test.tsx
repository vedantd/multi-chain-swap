import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useWalletLifecycle } from "../useWalletLifecycle";

const mockPublicKey = {
  toBase58: () => "So1eTestPub1icKey111111111111111111111111111",
};

const mockUseWallet = vi.fn();
vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => mockUseWallet(),
}));

function TestHarness() {
  useWalletLifecycle();
  return null;
}

describe("useWalletLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({
      publicKey: null,
      connected: false,
    });
  });

  it("logs Wallet connected when publicKey and connected become set", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockUseWallet.mockReturnValue({
      publicKey: mockPublicKey,
      connected: true,
    });
    render(<TestHarness />);
    expect(logSpy).toHaveBeenCalledWith("Wallet connected", {
      publicKey: "So1eTestPub1icKey111111111111111111111111111",
      readyForTx: true,
    });
    logSpy.mockRestore();
  });

  it("logs Wallet disconnected when going from connected to disconnected", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockUseWallet.mockReturnValue({
      publicKey: mockPublicKey,
      connected: true,
    });
    const { rerender } = render(<TestHarness />);
    expect(logSpy).toHaveBeenCalledWith("Wallet connected", {
      publicKey: "So1eTestPub1icKey111111111111111111111111111",
      readyForTx: true,
    });
    logSpy.mockClear();
    mockUseWallet.mockReturnValue({
      publicKey: null,
      connected: false,
    });
    rerender(<TestHarness />);
    expect(logSpy).toHaveBeenCalledWith("Wallet disconnected");
    logSpy.mockRestore();
  });
});
