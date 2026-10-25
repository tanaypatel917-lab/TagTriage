import { NextResponse } from "next/server";
import { handleRewrite, nimEnvFromProcess } from "@/server/nim";
import { clientKeyOf, createRateLimiter, rateLimitsFromProcess } from "@/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const rateLimits = rateLimitsFromProcess();
const perClientRateLimiter = createRateLimiter({ limit: rateLimits.perClientPerHour, windowMs: 60 * 60 * 1_000 });
const globalRateLimiter = createRateLimiter({ limit: rateLimits.globalPerDay, windowMs: 24 * 60 * 60 * 1_000 });

function rateLimited(retryAfterSec: number) {
  return NextResponse.json(
    { error: "rate_limited", message: "Too many rewrite requests. Try again later." },
    { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfterSec) } }
  );
}

export async function POST(request: Request) {
  const clientResult = perClientRateLimiter.check(clientKeyOf(request.headers));
  if (!clientResult.ok) return rateLimited(clientResult.retryAfterSec);

  const globalResult = globalRateLimiter.check("global");
  if (!globalResult.ok) return rateLimited(globalResult.retryAfterSec);

  const { status, body } = await handleRewrite(
    { rawBody: await request.text(), origin: request.headers.get("origin"), host: request.headers.get("host") },
    nimEnvFromProcess()
  );
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
