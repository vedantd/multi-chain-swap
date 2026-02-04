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
  const mockWallet = { adapter: { name: "Phantom" } };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({
      publicKey: null,
      connected: false,
      wallet: mockWallet,
    });
  });

  it("logs [Wallet] connected when publicKey and connected become set", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockUseWallet.mockReturnValue({
      publicKey: mockPublicKey,
      connected: true,
      wallet: mockWallet,
    });
    render(<TestHarness />);
    expect(logSpy).toHaveBeenCalledWith("[Wallet] connected", {
      walletName: "Phantom",
      publicKey: "So1eTestPub1icKey111111111111111111111111111",
      readyForTx: true,
    });
    logSpy.mockRestore();
  });

  it("logs [Wallet] disconnected when going from connected to disconnected", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockUseWallet.mockReturnValue({
      publicKey: mockPublicKey,
      connected: true,
      wallet: mockWallet,
    });
    const { rerender } = render(<TestHarness />);
    expect(logSpy).toHaveBeenCalledWith("[Wallet] connected", {
      walletName: "Phantom",
      publicKey: "So1eTestPub1icKey111111111111111111111111111",
      readyForTx: true,
    });
    logSpy.mockClear();
    mockUseWallet.mockReturnValue({
      publicKey: null,
      connected: false,
      wallet: mockWallet,
    });
    rerender(<TestHarness />);
    expect(logSpy).toHaveBeenCalledWith("[Wallet] disconnected", { walletName: "Phantom" });
    logSpy.mockRestore();
  });
});
