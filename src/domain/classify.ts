import { decodeFactsPayload, isFactsPayload, type OnTagFacts } from "./facts";
import type { AppState, TagView } from "./state";
import { isTagIdRecord, parseTagIdRecord } from "./tagId";

export type ReadClass =
  | { kind: "personal"; tagId: string; facts: OnTagFacts; tag?: TagView }
  | { kind: "encounter"; tagId: string; tag: TagView }
  | { kind: "foreign"; tagId: string }
  | { kind: "blank"; simulatedTagId?: string }
  | { kind: "invalid"; reason: string }
  | { kind: "not-tagtriage" };

const REASONS = {
  format: "The sticker ID is malformed.",
  version: "The sticker uses an unsupported format version.",
  checksum: "The sticker ID failed its checksum. The sticker may be damaged."
} as const;

export function classifyRead(texts: readonly string[], state: AppState, simulatedTagId?: string): ReadClass {
  const records = texts.map((text) => text.trim()).filter(Boolean);
  if (records.length === 0) return { kind: "blank", simulatedTagId };
  const idRecord = records.find(isTagIdRecord);
  const factsRecord = records.find(isFactsPayload);
  if (!idRecord) return factsRecord ? { kind: "invalid", reason: "Critical facts found but the sticker ID is missing." } : { kind: "not-tagtriage" };
  const parsed = parseTagIdRecord(idRecord);
  if (!parsed.ok) return { kind: "invalid", reason: REASONS[parsed.reason] };
  const tag = state.tags[parsed.tagId];
  if (factsRecord) {
    const facts = decodeFactsPayload(factsRecord);
    return facts ? { kind: "personal", tagId: parsed.tagId, facts, tag } : { kind: "invalid", reason: "The critical-facts record is unreadable." };
  }
  return tag ? { kind: "encounter", tagId: parsed.tagId, tag } : { kind: "foreign", tagId: parsed.tagId };
}
