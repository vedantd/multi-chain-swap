import { NextResponse } from "next/server";
import type { SwapParams } from "@/types/swap";
import { getQuotes } from "@/lib/swap/quoteService";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const params = body as Partial<SwapParams>;
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
    };

    console.log("[API /quotes] Request body:", JSON.stringify(swapParams, null, 2));
    console.log("[API /quotes] Destination address (recipient):", swapParams.recipientAddress);

    const result = await getQuotes(swapParams);

    console.log("[API /quotes] Result quotes count:", result.quotes.length, "best:", result.best?.provider ?? null);

    return NextResponse.json({
      success: true,
      data: { quotes: result.quotes, best: result.best },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch quotes";
    return NextResponse.json(
      {
        success: false,
        error: { code: "QUOTE_ERROR", message },
      },
      { status: 502 }
    );
  }
}
