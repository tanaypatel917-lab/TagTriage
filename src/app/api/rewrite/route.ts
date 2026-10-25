import { NextResponse } from "next/server";
import { handleRewrite, nimEnvFromProcess } from "@/server/nim";
import { clientKeyOf, consumeAll, createRateLimiter, rateLimitsFromProcess } from "@/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const rateLimits = rateLimitsFromProcess();
const perClientRateLimiter = createRateLimiter({ limit: rateLimits.perClientPerHour, windowMs: 60 * 60 * 1_000 });
const globalRateLimiter = createRateLimiter({ limit: rateLimits.globalPerDay, windowMs: 24 * 60 * 60 * 1_000 });

export async function POST(request: Request) {
  const { status, body, retryAfterSec } = await handleRewrite(
    {
      rawBody: await request.text(),
      origin: request.headers.get("origin"),
      host: request.headers.get("host"),
      consumeQuota: () =>
        consumeAll([
          [perClientRateLimiter, clientKeyOf(request.headers)],
          [globalRateLimiter, "global"]
        ])
    },
    nimEnvFromProcess()
  );
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(retryAfterSec !== undefined ? { "Retry-After": String(retryAfterSec) } : {})
    }
  });
}
