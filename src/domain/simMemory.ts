import type { AppState } from "./state";
import { encodeTagIdRecord } from "./tagId";

/** Virtual chip contents derived from the event log, so every synced device sees the same simulated stickers. */
export function simulatedMemory(state: AppState, tagId: string): string[] {
  const tag = state.tags[tagId];
  if (!tag || !tag.encoded) return [];
  return tag.onTagPayload ? [encodeTagIdRecord(tagId), tag.onTagPayload] : [encodeTagIdRecord(tagId)];
}
