import { describe, expect, it } from "vitest";
import { buildMciDrill } from "./drill";
import { project } from "./project";
import { TestDevice, rollDraft } from "./testing";
import { parseVitalsInput, validateVitals } from "./vitals";

function openEncounter() {
  const device = new TestDevice("A");
  device.mustWrite([rollDraft()]);
  device.mustWrite([{ type: "EncounterOpened", payload: { encounterId: "enc_1", tagId: "K7QX001", tagKind: "encounter" } }]);
  return device;
}

describe("encounter writes", () => {
  it("keeps triage mutually exclusive and ambulatory independent", () => {
    const device = openEncounter();
    device.mustWrite([{ type: "TriageSet", payload: { encounterId: "enc_1", category: "YELLOW" } }]);
    device.mustWrite([{ type: "AmbulatorySet", payload: { encounterId: "enc_1", ambulatory: true } }]);
    device.mustWrite([{ type: "TriageSet", payload: { encounterId: "enc_1", category: "RED" } }]);
    const encounter = device.state().encounters.enc_1;
    expect(encounter.triage?.category).toBe("RED");
    expect(encounter.triageHistory.map((t) => t.category)).toEqual(["YELLOW", "RED"]);
    expect(encounter.ambulatory).toBe(true);
  });

  it("appends vitals as an insert-only series and rejects impossible values", () => {
    const device = openEncounter();
    device.mustWrite([{ type: "VitalsRecorded", payload: { encounterId: "enc_1", vitals: { hr: 110, spo2: 94 }, takenAt: "2026-09-26T12:01:00.000Z" } }]);
    device.mustWrite([{ type: "VitalsRecorded", payload: { encounterId: "enc_1", vitals: { hr: 96 }, takenAt: "2026-09-26T12:05:00.000Z" } }]);
    expect(device.write([{ type: "VitalsRecorded", payload: { encounterId: "enc_1", vitals: { hr: 400 }, takenAt: "2026-09-26T12:06:00.000Z" } }])).toMatchObject({ ok: false, code: "invalid" });
    expect(device.state().encounters.enc_1.vitals.map((v) => v.vitals.hr)).toEqual([110, 96]);
  });

  it("moves forward only and reserves hand-off for custody transfer", () => {
    const device = openEncounter();
    device.mustWrite([{ type: "MovementSet", payload: { encounterId: "enc_1", state: "transporting" } }]);
    expect(device.write([{ type: "MovementSet", payload: { encounterId: "enc_1", state: "loaded" } }])).toMatchObject({ ok: false });
    expect(device.write([{ type: "MovementSet", payload: { encounterId: "enc_1", state: "handed-off" } }])).toMatchObject({ ok: false });
  });
});

describe("custody freeze", () => {
  it("rejects crew writes after custody transfer but still allows close and retire", () => {
    const device = openEncounter();
    device.mustWrite([{ type: "CustodyTransferred", payload: { encounterId: "enc_1", receiver: "RN Patel", facility: "County General" } }]);
    expect(device.state().encounters.enc_1.movement).toBe("handed-off");
    for (const draft of [
      { type: "TriageSet", payload: { encounterId: "enc_1", category: "GREEN" } },
      { type: "InterventionLogged", payload: { encounterId: "enc_1", code: "O2" } },
      { type: "CustodyTransferred", payload: { encounterId: "enc_1", receiver: "x", facility: "y" } }
    ] as const) {
      expect(device.write([draft])).toMatchObject({ ok: false, code: "post-custody-write" });
    }
    device.mustWrite([
      { type: "EncounterClosed", payload: { encounterId: "enc_1", disposition: "transported" } },
      { type: "TagRetired", payload: { tagId: "K7QX001", reason: "Encounter closed" } }
    ]);
    expect(device.write([{ type: "HistoryNoted", payload: { encounterId: "enc_1", field: "events", text: "late" } }])).toMatchObject({ ok: false, code: "write-after-close" });
  });

  it("surfaces offline writes that land after a merged custody transfer", () => {
    const shared = openEncounter();
    const tablet = new TestDevice("B", [...shared.log]);
    shared.mustWrite([{ type: "CustodyTransferred", payload: { encounterId: "enc_1", receiver: "RN Patel", facility: "County General" } }], { minute: 10 });
    tablet.mustWrite([{ type: "InterventionLogged", payload: { encounterId: "enc_1", code: "EPI" } }], { minute: 12 });
    const merged = project([...shared.log, ...tablet.log.filter((e) => e.deviceId === "B")]);
    expect(merged.encounters.enc_1.interventions).toEqual([]);
    expect(merged.conflicts).toEqual([expect.objectContaining({ kind: "post-custody-write", deviceId: "B" })]);
  });
});

describe("vitals validation", () => {
  it("enforces physiological ranges and integer rules", () => {
    expect(validateVitals({}).errors.form).toBeDefined();
    expect(validateVitals({ hr: 0, rr: 0 }).ok).toBe(true);
    expect(validateVitals({ hr: 301 }).errors.hr).toMatch(/0–300/);
    expect(validateVitals({ gcs: 2 }).errors.gcs).toBeDefined();
    expect(validateVitals({ gcs: 14.5 }).errors.gcs).toMatch(/whole/);
    expect(validateVitals({ spo2: 49 }).ok).toBe(false);
    expect(validateVitals({ tempF: 98.6 }).ok).toBe(true);
    expect(validateVitals({ sbp: 80, dbp: 90 }).errors.dbp).toMatch(/lower/);
    expect(validateVitals({ glucose: 5 }).ok).toBe(false);
  });

  it("warns on abnormal but valid values", () => {
    const check = validateVitals({ hr: 130, spo2: 88, glucose: 60 });
    expect(check.ok).toBe(true);
    expect(check.warnings).toEqual({ hr: "High", spo2: "Low", glucose: "Low" });
  });

  it("parses form strings and fails garbage", () => {
    expect(parseVitalsInput({ hr: " 88 ", rr: "" })).toEqual({ hr: 88 });
    expect(validateVitals(parseVitalsInput({ hr: "abc" })).ok).toBe(false);
  });
});

describe("MCI drill", () => {
  it("is deterministic and every draft validates", () => {
    const now = new Date("2026-09-26T12:00:00.000Z");
    const first = buildMciDrill({ seed: 7, now });
    expect(buildMciDrill({ seed: 7, now })).toEqual(first);
    const device = new TestDevice("A");
    device.mustWrite(first.drafts);
    const encounters = Object.values(device.state().encounters);
    expect(encounters).toHaveLength(12);
    const counts = encounters.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.triage?.category ?? "none"]: (acc[e.triage?.category ?? "none"] ?? 0) + 1 }), {});
    expect(counts).toEqual({ RED: 3, YELLOW: 4, GREEN: 4, BLACK: 1 });
    expect(encounters.filter((e) => e.movement === "handed-off")).toHaveLength(1);
    expect(encounters.every((e) => e.incidentId === first.incidentId)).toBe(true);
  });
});
