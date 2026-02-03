import { vi } from "vitest";

// Mock clusterApiUrl so provider does not depend on Node/browser RPC at test time
vi.mock("@solana/web3.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solana/web3.js")>();
  return {
    ...actual,
    clusterApiUrl: vi.fn(() => "https://api.mainnet-beta.solana.com"),
  };
});
