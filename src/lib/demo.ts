import type { EventDraft } from "@/domain/events";
import { newId, newRollCode } from "@/domain/ids";
import { defaultLowStockAt } from "@/domain/inventory";
import type { AppState } from "@/domain/state";

export const DEMO_BATCHES = { medic: "LOT-A24-117", clinic: "LOT-B25-003", recalled: "LOT-X23-900" } as const;

function isoDatePlusDays(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export function uniqueRollCode(used: Iterable<string>): string {
  const taken = new Set(used);
  let code = newRollCode();
  while (taken.has(code)) code = newRollCode();
  taken.add(code);
  return code;
}

export function hasDemoStickers(state: AppState): boolean {
  return Object.values(state.rolls).some((roll) => roll.batch === DEMO_BATCHES.medic);
}

/** Three demo rolls: a healthy ambulance roll, a clinic roll close to adhesive expiry, and a recalled batch. */
export function demoRollDrafts(state: AppState, now: Date): EventDraft[] {
  const used = new Set(Object.values(state.rolls).map((roll) => roll.rollCode));
  const roll = (unit: string, batch: string, size: number, preEncoded: number, expiryDays: number): EventDraft => {
    const rollCode = uniqueRollCode(used);
    used.add(rollCode);
    return {
      type: "RollAdded",
      payload: { rollId: newId("roll"), rollCode, unit, batch, size, preEncoded, adhesiveExpiry: isoDatePlusDays(now, expiryDays), lowStockAt: defaultLowStockAt(size) }
    };
  };
  return [
    roll("Medic 12", DEMO_BATCHES.medic, 40, 30, 540),
    roll("Community Clinic", DEMO_BATCHES.clinic, 12, 12, 21),
    roll("Medic 7", DEMO_BATCHES.recalled, 20, 20, 300),
    { type: "BatchRecalled", payload: { batch: DEMO_BATCHES.recalled, reason: "Adhesive failure reported by the manufacturer" } }
  ];
}
