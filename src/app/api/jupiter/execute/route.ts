/**
 * POST /api/jupiter/execute
 * Proxies signed Jupiter Ultra Swap transaction to Jupiter execute endpoint.
 * Keeps JUPITER_API_KEY server-side.
 */

import { NextResponse } from "next/server";

const JUPITER_ULTRA_EXECUTE = "https://api.jup.ag/ultra/v1/execute";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { signedTransaction, requestId } = body as { signedTransaction?: string; requestId?: string };

    if (typeof signedTransaction !== "string" || !signedTransaction.trim()) {
      return NextResponse.json(
        { error: "signedTransaction is required", code: 400 },
        { status: 400 }
      );
    }
    if (typeof requestId !== "string" || !requestId.trim()) {
      return NextResponse.json(
        { error: "requestId is required", code: 400 },
        { status: 400 }
      );
    }

    const apiKey = process.env.JUPITER_API_KEY;
    if (!apiKey?.trim()) {
      return NextResponse.json(
        { error: "Jupiter API not configured", code: 500 },
        { status: 500 }
      );
    }

    const res = await fetch(JUPITER_ULTRA_EXECUTE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ signedTransaction: signedTransaction.trim(), requestId: requestId.trim() }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        {
          error: (data as { error?: string }).error ?? `Jupiter execute failed: ${res.status}`,
          code: (data as { code?: number }).code ?? res.status,
        },
        { status: res.status >= 400 && res.status < 500 ? res.status : 502 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[jupiter/execute]", err);
    return NextResponse.json(
      { error: "Failed to execute Jupiter swap", code: 500 },
      { status: 500 }
    );
  }
}
