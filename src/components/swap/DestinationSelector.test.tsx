"use client";

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DestinationSelector } from "./DestinationSelector";

describe("DestinationSelector", () => {
  const chainOptions = [
    { value: "1", label: "Ethereum" },
    { value: "8453", label: "Base" },
  ];

  const tokenOptions = [
    { value: "0xusdc", label: "USDC", sublabel: "USD Coin" },
    { value: "0xmon", label: "MON", sublabel: "Mon" },
  ];

  it("opens the sheet and allows selecting chain and token", () => {
    const onChangeChain = vi.fn();
    const onChangeToken = vi.fn();

    render(
      <DestinationSelector
        destinationChainId={8453}
        destinationToken={"0xusdc"}
        destinationChainOptions={chainOptions}
        destinationTokenOptions={tokenOptions}
        onChangeChain={onChangeChain}
        onChangeToken={onChangeToken}
      />
    );

    // Open sheet
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Select destination")).toBeInTheDocument();

    // Select a different chain
    fireEvent.click(screen.getByText("Ethereum"));
    expect(onChangeChain).toHaveBeenCalledWith(1);

    // Select a token row
    fireEvent.click(screen.getByText("MON"));
    expect(onChangeToken).toHaveBeenCalledWith("0xmon");
  });
}

