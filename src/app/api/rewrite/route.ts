import { NextResponse } from "next/server";
import { handleRewrite, nimEnvFromProcess } from "@/server/nim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const { status, body } = await handleRewrite(
    { rawBody: await request.text(), origin: request.headers.get("origin"), host: request.headers.get("host") },
    nimEnvFromProcess()
  );
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
