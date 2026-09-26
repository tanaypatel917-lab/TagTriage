import { normalizeExtraction } from "@/domain/extraction";
import type { CriticalFacts } from "@/domain/facts";
import { buildSummary, type EmsSummary } from "@/domain/summary";
import { localRewrite } from "./local";
import { ImageNeedsNimError, type SummaryRewriter } from "./types";

export interface NimDeps {
  fetchImpl: typeof fetch;
  online: () => boolean;
  now: () => Date;
  endpoint: string;
}

const defaultDeps = (): NimDeps => ({
  fetchImpl: (...args) => fetch(...args),
  online: () => typeof navigator === "undefined" || navigator.onLine,
  now: () => new Date(),
  endpoint: "/api/rewrite"
});

function messageOf(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null && typeof (body as { message?: unknown }).message === "string") {
    return (body as { message: string }).message;
  }
  return `HTTP ${status}`;
}

/**
 * Rewrites a record through the server-side NIM route. Falls back to the deterministic local extractor whenever NIM
 * is unavailable; image-only records cannot fall back and raise ImageNeedsNimError instead.
 */
export async function nimRewrite(
  documentText: string,
  facts: CriticalFacts,
  documentImage?: string,
  deps: Partial<NimDeps> = {}
): Promise<EmsSummary> {
  const { fetchImpl, online, now, endpoint } = { ...defaultDeps(), ...deps };
  const text = documentText.trim();
  const fallback = (reason: string) => {
    if (!text) throw new ImageNeedsNimError(reason);
    return localRewrite(text, facts, reason, now());
  };
  if (!text && !documentImage) return localRewrite("", facts, "No medical record provided", now());
  if (!online()) return fallback("Offline");

  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentText: text || undefined, documentImage })
    });
  } catch {
    return fallback("NVIDIA NIM is unreachable");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) return fallback(`NVIDIA NIM unavailable: ${messageOf(body, response.status)}`);
  const result = (body ?? {}) as { extracted?: unknown; model?: unknown; visionModel?: unknown; transcript?: unknown };
  const extracted = normalizeExtraction(result.extracted);
  if (!extracted) return fallback("NVIDIA NIM returned an unexpected response");
  return buildSummary(
    facts,
    extracted,
    {
      id: "nim",
      model: typeof result.model === "string" ? result.model : undefined,
      visionModel: typeof result.visionModel === "string" ? result.visionModel : undefined
    },
    now(),
    typeof result.transcript === "string" ? result.transcript : undefined
  );
}

export const nimRewriter: SummaryRewriter = {
  id: "nim",
  rewrite: ({ documentText, facts, documentImage }) => nimRewrite(documentText, facts, documentImage)
};
