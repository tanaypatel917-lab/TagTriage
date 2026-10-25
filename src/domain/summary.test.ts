import { describe, expect, it } from "vitest";
import { localExtract } from "./extraction";
import { emptyFacts, type CriticalFacts } from "./facts";
import { encounterToFhirBundle } from "./fhir";
import { SAMPLE_RECORD } from "./samples";
import { buildSummary, mergeFacts } from "./summary";
import { TestDevice, rollDraft } from "./testing";

const now = new Date("2026-09-26T12:00:00Z");
const manual: CriticalFacts = {
  ...emptyFacts(),
  name: "Margaret Chen",
  birthYear: 1947,
  bloodType: "A+",
  allergies: ["penicillin", "latex"],
  conditions: ["atrial fibrillation"],
  anticoagulants: false,
  emergencyContact: "David Chen (son) 555-0142"
};

describe("mergeFacts", () => {
  it("unions lists and never sets DNR from the record", () => {
    const merged = mergeFacts(manual, localExtract(SAMPLE_RECORD));
    expect(merged.allergies).toEqual(["penicillin", "latex", "Penicillin (hives)", "Sulfa"]);
    expect(merged.dnr).toBe(false);
    expect(merged.recordSuggestsDnr).toBe(true);
    expect(merged.anticoagulants).toBe(true);
    expect(merged.anticoagulantNames).toEqual(["apixaban"]);
  });

  it("drops NKDA and warns when the record lists allergies", () => {
    const merged = mergeFacts({ ...manual, allergies: [], nkda: true }, { allergies: ["latex"], medications: [], conditions: [], anticoagulants: false, dnr: false });
    expect(merged.nkda).toBe(false);
    expect(merged.warnings).toHaveLength(1);
  });
});

describe("buildSummary", () => {
  it("ranks alerts deterministically and composes a headline", () => {
    const summary = buildSummary({ ...manual, dnr: true }, localExtract(SAMPLE_RECORD), { id: "local" }, now);
    expect(summary.alerts.map((a) => a.kind)).toEqual(["code-status", "anticoagulant", "allergy", "condition-high", "condition", "medication", "blood-type", "contact"]);
    expect(summary.alerts.map((a) => a.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(summary.headline).toBe("Margaret Chen · ~79y · DNR · BLOOD THINNERS · Allergies: penicillin, latex, Penicillin (hives), Sulfa");
    expect(summary.pendingConfirmations).toEqual([]);
  });

  it("asks for confirmation when only the record mentions DNR", () => {
    const summary = buildSummary(manual, localExtract(SAMPLE_RECORD), { id: "nim", model: "m" }, now);
    expect(summary.pendingConfirmations).toEqual(["dnr"]);
    expect(summary.alerts[0].kind).toBe("unconfirmed-dnr");
    expect(summary.headline).not.toContain("DNR");
  });

  it("says allergies are not recorded rather than none", () => {
    expect(buildSummary({ ...emptyFacts(), name: "X" }, null, { id: "local" }, now).headline).toBe("X · Allergies: none recorded");
  });
});

describe("FHIR export", () => {
  it("builds a bundle with encounter, vitals, procedures and flags", () => {
    const device = new TestDevice("A");
    device.mustWrite([rollDraft()]);
    device.mustWrite([
      { type: "EncounterOpened", payload: { encounterId: "enc_1", tagId: "K7QX001", tagKind: "encounter" } },
      { type: "TriageSet", payload: { encounterId: "enc_1", category: "RED" } },
      { type: "VitalsRecorded", payload: { encounterId: "enc_1", vitals: { hr: 120, sbp: 90, dbp: 60 }, takenAt: "2026-09-26T12:01:00.000Z" } },
      { type: "InterventionLogged", payload: { encounterId: "enc_1", code: "TQ" } },
      { type: "CustodyTransferred", payload: { encounterId: "enc_1", receiver: "RN Patel", facility: "County General" } }
    ]);
    const bundle = encounterToFhirBundle(device.state().encounters.enc_1, { ...manual, dnr: true, anticoagulants: true }, now);
    const types = bundle.entry.map((e) => e.resource.resourceType);
    expect(types.filter((t) => t === "Observation")).toHaveLength(3);
    expect(types).toEqual(expect.arrayContaining(["Patient", "Encounter", "Procedure", "AllergyIntolerance", "Condition", "Flag", "Provenance"]));
    expect(bundle.entry.every((e) => /^urn:uuid:[0-9a-f-]{36}$/.test(e.fullUrl))).toBe(true);
    expect(encounterToFhirBundle(device.state().encounters.enc_1, manual, now).id).toBe(bundle.id);
  });
});
