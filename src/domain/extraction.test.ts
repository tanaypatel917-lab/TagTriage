import { describe, expect, it } from "vitest";
import { detectDnr, extractFirstJsonObject, localExtract, normalizeExtraction } from "./extraction";
import { SAMPLE_RECORD } from "./samples";

describe("extractFirstJsonObject", () => {
  it("finds JSON inside code fences and reasoning prose", () => {
    const text = 'Thinking about it... {not json} ok here:\n```json\n{"allergies":["latex"],"dnr":false}\n```';
    expect(extractFirstJsonObject(text)).toEqual({ allergies: ["latex"], dnr: false });
  });

  it("ignores braces inside strings and handles nesting", () => {
    expect(extractFirstJsonObject('x {"a":"}{","b":{"c":1}} y')).toEqual({ a: "}{", b: { c: 1 } });
  });

  it("returns null when nothing parses", () => {
    expect(extractFirstJsonObject("no json here")).toBeNull();
    expect(extractFirstJsonObject("{broken")).toBeNull();
  });
});

describe("normalizeExtraction", () => {
  it("coerces, trims, dedupes and caps", () => {
    const result = normalizeExtraction({
      allergies: ["Latex", " latex ", "none", "NKDA"],
      medications: "Warfarin 5mg, Aspirin",
      conditions: [1, null, "COPD", "x".repeat(200), ...Array.from({ length: 40 }, (_, i) => `c${i}`)],
      anticoagulants: "yes",
      dnr: 0
    });
    expect(result?.allergies).toEqual(["Latex"]);
    expect(result?.nkda).toBe(true);
    expect(result?.medications).toEqual(["Warfarin 5mg", "Aspirin"]);
    expect(result?.conditions[0]).toBe("1");
    expect(result?.conditions[2]).toHaveLength(80);
    expect(result?.conditions).toHaveLength(25);
    expect(result?.anticoagulants).toBe(true);
    expect(result?.dnr).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(normalizeExtraction(null)).toBeNull();
    expect(normalizeExtraction(["a"])).toBeNull();
    expect(normalizeExtraction("text")).toBeNull();
  });
});

describe("localExtract", () => {
  it("reads section headers and detects anticoagulants and DNR", () => {
    const result = localExtract(SAMPLE_RECORD);
    expect(result.allergies).toEqual(["Penicillin (hives)", "Sulfa"]);
    expect(result.medications).toEqual(["Eliquis 5 mg twice daily", "Metformin 500 mg", "Lisinopril 10 mg"]);
    expect(result.conditions).toEqual(["Atrial fibrillation", "Type 2 diabetes", "Hypertension", "CKD stage 3"]);
    expect(result.anticoagulants).toBe(true);
    expect(result.dnr).toBe(true);
  });

  it("handles NKDA and full code", () => {
    const result = localExtract("Allergies: NKDA\nMeds: metformin\nCode status: Full code");
    expect(result.allergies).toEqual([]);
    expect(result.nkda).toBe(true);
    expect(result.anticoagulants).toBe(false);
    expect(result.dnr).toBe(false);
  });

  it("falls back to condition keywords without headers", () => {
    expect(localExtract("Has COPD and uses home oxygen. History of stroke.").conditions).toEqual(
      expect.arrayContaining(["COPD / home oxygen", "Prior stroke"])
    );
  });

  it("does not treat negated DNR as DNR", () => {
    expect(detectDnr("Patient is not DNR")).toBe(false);
    expect(detectDnr("Do not resuscitate")).toBe(true);
    expect(detectDnr("No CPR per POLST")).toBe(true);
  });
});
