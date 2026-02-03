import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { WalletConnectButton } from "../WalletConnectButton";

const mockDisconnect = vi.fn();

vi.mock("@solana/wallet-adapter-react-ui", () => ({
  WalletMultiButton: ({
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" data-testid="wallet-multi-button" {...props}>
      Wallet Button
    </button>
  ),
}));

const mockUseWallet = vi.fn();
vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => mockUseWallet(),
}));

describe("WalletConnectButton", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({
      publicKey: null,
      connected: false,
      connecting: false,
      disconnect: mockDisconnect,
      select: vi.fn(),
      connect: vi.fn(),
      wallet: null,
      wallets: [],
      ready: true,
    });
  });

  it("renders wallet button when disconnected", () => {
    render(<WalletConnectButton />);
    expect(screen.getByTestId("wallet-multi-button")).toBeDefined();
    expect(screen.getByRole("button", { name: /Wallet Button/i })).toBeDefined();
  });

  it("renders wallet button when connected", () => {
    mockUseWallet.mockReturnValue({
      publicKey: { toBase58: () => "So1eTestPub1icKey111111111111111111111111111" },
      connected: true,
      connecting: false,
      disconnect: mockDisconnect,
      select: vi.fn(),
      connect: vi.fn(),
      wallet: null,
      wallets: [],
      ready: true,
    });
    render(<WalletConnectButton />);
    expect(screen.getByTestId("wallet-multi-button")).toBeDefined();
  });
});
