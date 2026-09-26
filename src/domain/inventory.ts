import type { AppState, RollView, TagView } from "./state";

export interface RollCounts {
  remaining: number;
  remainingPreEncoded: number;
  remainingBlank: number;
  claimed: number;
  issued: number;
  retired: number;
}

export type ExpiryStatus = "ok" | "soon" | "expired";

export const EXPIRY_SOON_DAYS = 30;

export function defaultLowStockAt(size: number): number {
  return Math.max(3, Math.ceil(size * 0.2));
}

export function rollTags(roll: RollView, state: AppState): TagView[] {
  return roll.tagIds.map((id) => state.tags[id]).filter((tag): tag is TagView => tag !== undefined);
}

export function rollCounts(roll: RollView, state: AppState): RollCounts {
  const counts: RollCounts = { remaining: 0, remainingPreEncoded: 0, remainingBlank: 0, claimed: 0, issued: 0, retired: 0 };
  for (const tag of rollTags(roll, state)) {
    if (tag.kind === "unassigned" && tag.state === "available") {
      counts.remaining++;
      if (tag.encoded) counts.remainingPreEncoded++;
      else counts.remainingBlank++;
    }
    if (tag.kind === "encounter") counts.claimed++;
    if (tag.kind === "personal") counts.issued++;
    if (tag.state === "retired") counts.retired++;
  }
  return counts;
}

export function isLowStock(roll: RollView, counts: RollCounts): boolean {
  return counts.remaining <= roll.lowStockAt;
}

export function daysUntil(isoDate: string, now: Date): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - today) / 86_400_000);
}

export function expiryStatus(roll: RollView, now: Date): ExpiryStatus {
  const days = daysUntil(roll.adhesiveExpiry, now);
  if (days < 0) return "expired";
  return days <= EXPIRY_SOON_DAYS ? "soon" : "ok";
}

/** Lowest-index available sticker, preferring pre-encoded ones. */
export function nextAvailableTag(roll: RollView, state: AppState): TagView | undefined {
  const available = rollTags(roll, state).filter((tag) => tag.kind === "unassigned" && tag.state === "available");
  return available.find((tag) => tag.encoded) ?? available[0];
}

export function usableRolls(state: AppState): RollView[] {
  return Object.values(state.rolls).filter((roll) => !roll.recalled && rollCounts(roll, state).remaining > 0);
}

export function batches(state: AppState): string[] {
  return [...new Set(Object.values(state.rolls).map((roll) => roll.batch))].sort();
}
