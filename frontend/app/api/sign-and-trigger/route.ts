import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

/*
 * Server-side Route Handler for the "Send test event" feature.
 *
 * The webhook signing uses Node's `crypto` module (HMAC-SHA256), which is
 * unavailable in browser JS. By running this server-side, the secret is
 * never transmitted in a client-side network request beyond what the
 * flow-detail page already shows the user.
 *
 * Request body (JSON):
 *   { flowId: string; secret: string; payload: string }
 *
 * The `payload` field must be an already-serialized JSON string — the exact
 * bytes we'll sign and forward, to avoid any key-ordering / whitespace drift.
 *
 * Returns:
 *   { runId: string; status: "success" | "filtered" | "failed" }  on success
 *   { error: { code, message, details } }                          on failure
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { flowId: string; secret: string; payload: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body", details: {} } },
      { status: 400 },
    );
  }

  const { flowId, secret, payload } = body;
  if (!flowId || !secret || !payload) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "flowId, secret, and payload are required",
          details: {},
        },
      },
      { status: 400 },
    );
  }

  // Compute HMAC-SHA256 signature exactly as the backend expects:
  // "sha256=" + hex(HMAC-SHA256(rawBodyString, webhookSecret))
  const signature =
    "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");

  const hookUrl = `${BACKEND_URL}/api/hooks/${flowId}`;

  let hookRes: Response;
  try {
    hookRes = await fetch(hookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Flowlet-Signature": signature,
      },
      body: payload,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return NextResponse.json(
      { error: { code: "NETWORK_ERROR", message, details: {} } },
      { status: 502 },
    );
  }

  // Forward the backend's response (success or error) as-is.
  // Guard against non-JSON bodies (e.g. a proxy returning an HTML error page).
  let json: unknown;
  try {
    json = await hookRes.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "PARSE_ERROR",
          message: `Backend returned HTTP ${hookRes.status} with a non-JSON body`,
          details: {},
        },
      },
      { status: hookRes.status >= 400 ? hookRes.status : 502 },
    );
  }
  return NextResponse.json(json, { status: hookRes.status });
}
