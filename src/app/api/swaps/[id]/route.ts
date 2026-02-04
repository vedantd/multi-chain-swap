/**
 * GET /api/swaps/[id]
 * 
 * Fetch a single swap by ID
 */

import { NextRequest, NextResponse } from "next/server";
import { getSwapById } from "@/lib/swap/history";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const swap = getSwapById(id);

    if (!swap) {
      return NextResponse.json({ error: "Swap not found" }, { status: 404 });
    }

    return NextResponse.json(swap);
  } catch (error) {
    console.error("[swap detail API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch swap details" },
      { status: 500 }
    );
  }
}
