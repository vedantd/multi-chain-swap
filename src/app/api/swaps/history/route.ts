/**
 * GET /api/swaps/history
 * 
 * Fetch swap history for a user with pagination and filters
 */

import { NextRequest, NextResponse } from "next/server";
import { getSwapHistory } from "@/lib/swap/history";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userAddress = searchParams.get("userAddress");

    if (!userAddress) {
      return NextResponse.json(
        { error: "userAddress query parameter is required" },
        { status: 400 }
      );
    }

    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : undefined;
    const offset = searchParams.get("offset")
      ? parseInt(searchParams.get("offset")!, 10)
      : undefined;
    const status = searchParams.get("status") as
      | "pending"
      | "confirmed"
      | "finalized"
      | "failed"
      | "completed"
      | undefined;
    const provider = searchParams.get("provider") as "relay" | "debridge" | undefined;

    const result = getSwapHistory({
      userAddress,
      limit,
      offset,
      status,
      provider,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[swap history API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch swap history" },
      { status: 500 }
    );
  }
}
