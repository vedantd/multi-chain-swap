// External dependencies
import { NextResponse } from "next/server";

// Internal types
import type { SwapParams } from "@/types/swap";

// Internal utilities/lib functions
import { getQuotes, NeedSolForGasError } from "@/lib/swap/quoteService";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const params = body as Partial<SwapParams> & {
      userSOLBalance?: string;
      userSolanaUSDCBalance?: string;
    };
    if (
      typeof params.originChainId !== "number" ||
      typeof params.destinationChainId !== "number" ||
      typeof params.originToken !== "string" ||
      typeof params.destinationToken !== "string" ||
      typeof params.amount !== "string" ||
      typeof params.userAddress !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Missing or invalid: originChainId, destinationChainId, originToken, destinationToken, amount, userAddress",
          },
        },
        { status: 400 }
      );
    }

    const rawAmount = String(params.amount ?? "").replace(/\D/g, "");
    const amount = rawAmount.replace(/^0+/, "") || "0";

    const swapParams: SwapParams = {
      originChainId: params.originChainId,
      destinationChainId: params.destinationChainId,
      originToken: params.originToken,
      destinationToken: params.destinationToken,
      amount,
      userAddress: params.userAddress,
      recipientAddress: params.recipientAddress ?? params.userAddress,
      tradeType: params.tradeType ?? "exact_in",
      depositFeePayer:
        typeof params.depositFeePayer === "string" && params.depositFeePayer
          ? params.depositFeePayer
          : undefined,
      // Optional Relay quote parameters
      slippageTolerance:
        typeof params.slippageTolerance === "string" && params.slippageTolerance
          ? params.slippageTolerance
          : undefined,
      refundTo:
        typeof params.refundTo === "string" && params.refundTo
          ? params.refundTo
          : undefined,
      referrer:
        typeof params.referrer === "string" && params.referrer
          ? params.referrer
          : undefined,
      topupGas:
        typeof params.topupGas === "boolean" ? params.topupGas : undefined,
      topupGasAmount:
        typeof params.topupGasAmount === "string" && params.topupGasAmount
          ? params.topupGasAmount
          : undefined,
      useExternalLiquidity:
        typeof params.useExternalLiquidity === "boolean"
          ? params.useExternalLiquidity
          : undefined,
      appFees:
        Array.isArray(params.appFees) && params.appFees.length > 0
          ? params.appFees
          : undefined,
    };

    const sameChain = swapParams.originChainId === swapParams.destinationChainId;
    const sameToken =
      swapParams.originToken.trim().toLowerCase() === swapParams.destinationToken.trim().toLowerCase();
    if (sameChain && sameToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Same token on same chain is not a valid swap. Choose a different destination token or chain.",
          },
        },
        { status: 400 }
      );
    }

    const userSOLBalance =
      typeof params.userSOLBalance === "string" && params.userSOLBalance.trim() !== ""
        ? params.userSOLBalance.trim()
        : undefined;
    const userSolanaUSDCBalance =
      typeof params.userSolanaUSDCBalance === "string" && params.userSolanaUSDCBalance.trim() !== ""
        ? params.userSolanaUSDCBalance.trim()
        : undefined;

    console.log("[API /quotes] Request body:", JSON.stringify(swapParams, null, 2));
    console.log("[API /quotes] chains:", swapParams.originChainId, "->", swapParams.destinationChainId, "recipient:", swapParams.recipientAddress ?? swapParams.userAddress);
    if (userSOLBalance !== undefined) {
      console.log("[API /quotes] userSOLBalance (lamports) provided");
    }
    if (userSolanaUSDCBalance !== undefined) {
      console.log("[API /quotes] userSolanaUSDCBalance (raw) provided");
    }

    const result = await getQuotes(swapParams, undefined, userSOLBalance, userSolanaUSDCBalance);

    console.log("[API /quotes] Result quotes count:", result.quotes.length, "best:", result.best?.provider ?? null);

    return NextResponse.json({
      success: true,
      data: { quotes: result.quotes, best: result.best },
    });
  } catch (err) {
    if (err instanceof NeedSolForGasError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NEED_SOL_FOR_GAS",
            message: err.message,
          },
        },
        { status: 400 }
      );
    }
    const message = err instanceof Error ? err.message : "";
    const isNoRoutes =
      message.startsWith("No quotes available") ||
      message === "No eligible quotes available";
    if (isNoRoutes) {
      return NextResponse.json({
        success: true,
        data: { quotes: [], best: null },
      });
    }
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "QUOTE_ERROR",
          message: message || "Failed to fetch quotes",
        },
      },
      { status: 502 }
    );
  }
}
