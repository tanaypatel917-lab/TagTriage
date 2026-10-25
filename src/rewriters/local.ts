import { localExtract } from "@/domain/extraction";
import type { CriticalFacts } from "@/domain/facts";
import { buildSummary, type EmsSummary } from "@/domain/summary";
import type { SummaryRewriter } from "./types";

export function localRewrite(documentText: string, facts: CriticalFacts, fallbackReason?: string, now = new Date()): EmsSummary {
  const text = documentText.trim();
  return buildSummary(facts, text ? localExtract(text) : null, { id: "local", fallbackReason }, now);
}

export const localRewriter: SummaryRewriter = {
  id: "local",
  rewrite: async ({ documentText, facts }) => localRewrite(documentText, facts)
};
