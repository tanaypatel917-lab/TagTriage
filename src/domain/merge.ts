import type { AppEvent } from "./events";
import type { Conflict } from "./state";

export interface MergeReport {
  toAdd: AppEvent[];
  duplicates: number;
  idMismatches: { id: string; local: AppEvent; incoming: AppEvent }[];
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Grow-only set union keyed by event id. Same id with different content is an integrity problem, never overwritten. */
export function mergeEventLogs(local: readonly AppEvent[], incoming: readonly AppEvent[]): MergeReport {
  const known = new Map(local.map((event) => [event.id, event]));
  const report: MergeReport = { toAdd: [], duplicates: 0, idMismatches: [] };
  for (const event of incoming) {
    const existing = known.get(event.id);
    if (!existing) {
      known.set(event.id, event);
      report.toAdd.push(event);
    } else if (stableStringify(existing) === stableStringify(event)) {
      report.duplicates++;
    } else {
      report.idMismatches.push({ id: event.id, local: existing, incoming: event });
    }
  }
  return report;
}

export function diffConflicts(before: readonly Conflict[], after: readonly Conflict[]): Conflict[] {
  const seen = new Set(before.map((conflict) => conflict.id));
  return after.filter((conflict) => !seen.has(conflict.id));
}
