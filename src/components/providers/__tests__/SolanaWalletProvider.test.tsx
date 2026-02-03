import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SolanaWalletProvider } from "../SolanaWalletProvider";

// Mock wallet adapter react so we don't need real wallet context for provider tree
vi.mock("@solana/wallet-adapter-react", () => ({
  ConnectionProvider: ({
    children,
  }: {
    children: React.ReactNode;
    endpoint: string;
  }) => <div data-testid="connection-provider">{children}</div>,
  WalletProvider: ({
    children,
  }: {
    children: React.ReactNode;
    wallets: unknown[];
    autoConnect: boolean;
  }) => <div data-testid="wallet-provider">{children}</div>,
  WalletModalProvider: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <div data-testid="wallet-modal-provider">{children}</div>,
}));

describe("SolanaWalletProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing and composes ConnectionProvider, WalletProvider, and children", () => {
    render(
      <SolanaWalletProvider>
        <span>Child</span>
      </SolanaWalletProvider>
    );
    expect(screen.getByTestId("connection-provider")).toBeDefined();
    expect(screen.getByTestId("wallet-provider")).toBeDefined();
    expect(screen.getByText("Child")).toBeDefined();
  });
});
