import { describe, expect, it } from "vitest";
import type { AppEvent } from "./events";
import { diffConflicts, mergeEventLogs } from "./merge";
import { project } from "./project";
import { TestDevice, rollDraft } from "./testing";

function union(a: AppEvent[], b: AppEvent[]): AppEvent[] {
  return [...a, ...mergeEventLogs(a, b).toAdd];
}

function twoDevices() {
  const base = new TestDevice("A");
  base.mustWrite([rollDraft()]);
  const other = new TestDevice("B", [...base.log]);
  return { a: base, b: other };
}

describe("event log merge", () => {
  it("is idempotent and commutative", () => {
    const { a, b } = twoDevices();
    a.mustWrite([{ type: "EncounterOpened", payload: { encounterId: "enc_a", tagId: "K7QX001", tagKind: "encounter" } }]);
    b.mustWrite([{ type: "EncounterOpened", payload: { encounterId: "enc_b", tagId: "K7QX002", tagKind: "encounter" } }]);
    const ab = union(a.log, b.log);
    const ba = union(b.log, a.log);
    expect(JSON.stringify(project(ab))).toBe(JSON.stringify(project(ba)));
    const report = mergeEventLogs(ab, b.log);
    expect(report.toAdd).toEqual([]);
    expect(report.duplicates).toBe(b.log.length);
  });

  it("keeps the earliest of duplicate same-encounter claims", () => {
    const { a, b } = twoDevices();
    const claim = { type: "EncounterOpened", payload: { encounterId: "enc_same", tagId: "K7QX001", tagKind: "encounter" } } as const;
    a.mustWrite([claim], { minute: 5 });
    b.mustWrite([claim], { minute: 3 });
    const state = project(union(a.log, b.log));
    expect(state.encounters.enc_same.opened.deviceId).toBe("B");
    expect(state.duplicateClaims).toBe(1);
    expect(state.conflicts).toEqual([]);
  });

  it("surfaces cross-encounter claims without losing the later encounter's data", () => {
    const { a, b } = twoDevices();
    a.mustWrite([{ type: "EncounterOpened", payload: { encounterId: "enc_a", tagId: "K7QX001", tagKind: "encounter" } }], { minute: 2 });
    b.mustWrite([{ type: "EncounterOpened", payload: { encounterId: "enc_b", tagId: "K7QX001", tagKind: "encounter" } }], { minute: 4 });
    b.mustWrite([{ type: "TriageSet", payload: { encounterId: "enc_b", category: "RED" } }]);
    for (const log of [union(a.log, b.log), union(b.log, a.log)]) {
      const state = project(log);
      expect(state.tags.K7QX001.activeEncounterId).toBe("enc_a");
      expect(state.encounters.enc_b.tagConflict).toEqual({ tagId: "K7QX001", winner: "enc_a" });
      expect(state.encounters.enc_b.triage?.category).toBe("RED");
      expect(state.conflicts.map((c) => c.kind)).toEqual(["cross-encounter-claim"]);
    }
  });

  it("detects the same id with different content", () => {
    const { a } = twoDevices();
    const [event] = a.log;
    const tampered = { ...event, actor: "someone else" } as AppEvent;
    const report = mergeEventLogs(a.log, [tampered]);
    expect(report.idMismatches).toHaveLength(1);
    expect(report.toAdd).toEqual([]);
  });

  it("reports only conflicts introduced by the merge", () => {
    const { a, b } = twoDevices();
    a.mustWrite([{ type: "EncounterOpened", payload: { encounterId: "enc_a", tagId: "K7QX001", tagKind: "encounter" } }], { minute: 1 });
    b.mustWrite([{ type: "EncounterOpened", payload: { encounterId: "enc_b", tagId: "K7QX001", tagKind: "encounter" } }], { minute: 2 });
    const before = project(a.log).conflicts;
    const after = project(union(a.log, b.log)).conflicts;
    expect(diffConflicts(before, after)).toHaveLength(1);
  });
});
