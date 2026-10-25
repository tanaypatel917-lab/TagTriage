import { describe, expect, it } from "vitest";
import { classifyRead } from "./classify";
import { decideMany } from "./decide";
import { encodeFactsPayload, emptyFacts } from "./facts";
import { expiryStatus, isLowStock, nextAvailableTag, rollCounts } from "./inventory";
import { simulatedMemory } from "./simMemory";
import { encodeTagIdRecord } from "./tagId";
import { TestDevice, rollDraft } from "./testing";

function personalPayload(tagId: string) {
  return encodeFactsPayload({ ...emptyFacts(), name: "Ann Lee", birthYear: 1950 }, { idRecord: encodeTagIdRecord(tagId) });
}

describe("tag lifecycle", () => {
  it("claims, closes and retires an encounter sticker", () => {
    const device = new TestDevice("A");
    device.mustWrite([rollDraft()]);
    device.mustWrite([{ type: "EncounterOpened", payload: { encounterId: "enc_1", tagId: "K7QX001", tagKind: "encounter" } }]);
    expect(device.state().tags.K7QX001).toMatchObject({ state: "open", kind: "encounter", activeEncounterId: "enc_1" });
    device.mustWrite([{ type: "EncounterClosed", payload: { encounterId: "enc_1", disposition: "transported" } }]);
    expect(device.state().tags.K7QX001.state).toBe("closed");
    device.mustWrite([{ type: "TagRetired", payload: { tagId: "K7QX001", reason: "Encounter closed" } }]);
    expect(device.state().tags.K7QX001.state).toBe("retired");
  });

  it("rejects retiring an open sticker and claiming a blank one without encoding", () => {
    const device = new TestDevice("A");
    device.mustWrite([rollDraft()]);
    device.mustWrite([{ type: "EncounterOpened", payload: { encounterId: "enc_1", tagId: "K7QX001", tagKind: "encounter" } }]);
    expect(device.write([{ type: "TagRetired", payload: { tagId: "K7QX001", reason: "x" } }])).toMatchObject({ ok: false, code: "not-available" });
    expect(device.write([{ type: "EncounterOpened", payload: { encounterId: "enc_2", tagId: "K7QX009", tagKind: "encounter" } }])).toMatchObject({ ok: false, code: "not-available" });
    device.mustWrite([
      { type: "TagEncoded", payload: { tagId: "K7QX009" } },
      { type: "EncounterOpened", payload: { encounterId: "enc_2", tagId: "K7QX009", tagKind: "encounter" } }
    ]);
    expect(device.state().tags.K7QX009).toMatchObject({ encoded: true, state: "open" });
  });

  it("rejects a second claim on an open sticker", () => {
    const device = new TestDevice("A");
    device.mustWrite([rollDraft()]);
    device.mustWrite([{ type: "EncounterOpened", payload: { encounterId: "enc_1", tagId: "K7QX001", tagKind: "encounter" } }]);
    expect(device.write([{ type: "EncounterOpened", payload: { encounterId: "enc_2", tagId: "K7QX001", tagKind: "encounter" } }])).toMatchObject({ ok: false, code: "cross-encounter-claim" });
  });

  it("registers a personal sticker that stays registered through encounters and is never retired", () => {
    const device = new TestDevice("A");
    device.mustWrite([rollDraft()]);
    const { payload, bytes } = personalPayload("K7QX002");
    device.mustWrite([{ type: "ProfileRegistered", payload: { tagId: "K7QX002", onTagPayload: payload, payloadBytes: bytes, rewriter: "local" } }]);
    device.mustWrite([{ type: "EncounterOpened", payload: { encounterId: "enc_p", tagId: "K7QX002", tagKind: "personal" } }]);
    expect(device.state().tags.K7QX002).toMatchObject({ state: "registered", activeEncounterId: "enc_p" });
    expect(device.write([{ type: "EncounterOpened", payload: { encounterId: "enc_q", tagId: "K7QX002", tagKind: "personal" } }])).toMatchObject({ ok: false, code: "cross-encounter-claim" });
    device.mustWrite([{ type: "EncounterClosed", payload: { encounterId: "enc_p", disposition: "treated-released" } }]);
    expect(device.state().tags.K7QX002).toMatchObject({ state: "registered", activeEncounterId: undefined });
    expect(device.write([{ type: "TagRetired", payload: { tagId: "K7QX002", reason: "x" } }])).toMatchObject({ ok: false, code: "invalid" });
    device.mustWrite([{ type: "EncounterOpened", payload: { encounterId: "enc_r", tagId: "K7QX002", tagKind: "personal" } }]);
    expect(device.state().tags.K7QX002.encounterIds).toEqual(["enc_p", "enc_r"]);
  });

  it("blocks claims and registrations from a recalled batch", () => {
    const device = new TestDevice("A");
    device.mustWrite([rollDraft()]);
    device.mustWrite([{ type: "BatchRecalled", payload: { batch: "LOT-A", reason: "Adhesive failure" } }]);
    expect(device.state().rolls.roll_A).toMatchObject({ recalled: true, recallReason: "Adhesive failure" });
    expect(device.write([{ type: "EncounterOpened", payload: { encounterId: "enc_1", tagId: "K7QX001", tagKind: "encounter" } }])).toMatchObject({ ok: false, code: "recalled" });
    const { payload, bytes } = personalPayload("K7QX002");
    expect(device.write([{ type: "ProfileRegistered", payload: { tagId: "K7QX002", onTagPayload: payload, payloadBytes: bytes, rewriter: "none" } }])).toMatchObject({ ok: false, code: "recalled" });
  });

  it("adopts a foreign sticker and fills in its roll later", () => {
    const device = new TestDevice("A");
    device.mustWrite([{ type: "EncounterOpened", payload: { encounterId: "enc_f", tagId: "K7QX004", tagKind: "encounter" } }]);
    expect(device.state().tags.K7QX004).toMatchObject({ foreign: true, state: "open" });
    device.mustWrite([rollDraft()]);
    expect(device.state().tags.K7QX004).toMatchObject({ foreign: false, rollId: "roll_A", state: "open" });
  });

  it("is all-or-nothing and never mutates the input state", () => {
    const device = new TestDevice("A");
    device.mustWrite([rollDraft()]);
    const before = device.state();
    const snapshot = JSON.stringify(before);
    const result = decideMany(
      before,
      [
        { type: "EncounterOpened", payload: { encounterId: "enc_1", tagId: "K7QX001", tagKind: "encounter" } },
        { type: "TriageSet", payload: { encounterId: "enc_1", category: "RED" } },
        { type: "TriageSet", payload: { encounterId: "enc_missing", category: "RED" } }
      ],
      { actor: "x", deviceId: "A", firstSeq: 0, now: "2026-09-26T12:00:00.000Z", newEventId: () => "ev" }
    );
    expect(result).toMatchObject({ ok: false, index: 2 });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("inventory", () => {
  it("counts remaining, claimed, issued and retired stickers", () => {
    const device = new TestDevice("A");
    device.mustWrite([rollDraft()]);
    const { payload, bytes } = personalPayload("K7QX002");
    device.mustWrite([
      { type: "EncounterOpened", payload: { encounterId: "enc_1", tagId: "K7QX001", tagKind: "encounter" } },
      { type: "EncounterClosed", payload: { encounterId: "enc_1", disposition: "transported" } },
      { type: "TagRetired", payload: { tagId: "K7QX001", reason: "done" } },
      { type: "ProfileRegistered", payload: { tagId: "K7QX002", onTagPayload: payload, payloadBytes: bytes, rewriter: "local" } }
    ]);
    const state = device.state();
    const roll = state.rolls.roll_A;
    const counts = rollCounts(roll, state);
    expect(counts).toEqual({ remaining: 8, remainingPreEncoded: 6, remainingBlank: 2, claimed: 1, issued: 1, retired: 1 });
    expect(isLowStock(roll, counts)).toBe(false);
    expect(nextAvailableTag(roll, state)?.tagId).toBe("K7QX003");
  });

  it("flags expiry windows", () => {
    const device = new TestDevice("A");
    device.mustWrite([rollDraft({ adhesiveExpiry: "2026-10-10" })]);
    const roll = device.state().rolls.roll_A;
    expect(expiryStatus(roll, new Date("2026-09-26T12:00:00Z"))).toBe("soon");
    expect(expiryStatus(roll, new Date("2026-10-11T12:00:00Z"))).toBe("expired");
    expect(expiryStatus(roll, new Date("2026-01-01T12:00:00Z"))).toBe("ok");
  });
});

describe("reads and simulated memory", () => {
  it("classifies blank, encounter, personal, foreign and damaged stickers", () => {
    const device = new TestDevice("A");
    device.mustWrite([rollDraft()]);
    const { payload, bytes } = personalPayload("K7QX002");
    device.mustWrite([{ type: "ProfileRegistered", payload: { tagId: "K7QX002", onTagPayload: payload, payloadBytes: bytes, rewriter: "local" } }]);
    const state = device.state();
    expect(simulatedMemory(state, "K7QX009")).toEqual([]);
    expect(classifyRead(simulatedMemory(state, "K7QX009"), state, "K7QX009")).toEqual({ kind: "blank", simulatedTagId: "K7QX009" });
    expect(classifyRead(simulatedMemory(state, "K7QX001"), state)).toMatchObject({ kind: "encounter", tagId: "K7QX001" });
    expect(classifyRead(simulatedMemory(state, "K7QX002"), state)).toMatchObject({ kind: "personal", tagId: "K7QX002", facts: { name: "Ann Lee" } });
    expect(classifyRead([encodeTagIdRecord("ZZZZ001")], state)).toEqual({ kind: "foreign", tagId: "ZZZZ001" });
    expect(classifyRead(["tt:v1:K7QX001:0000"], state)).toMatchObject({ kind: "invalid" });
    expect(classifyRead(["https://example.com"], state)).toEqual({ kind: "not-tagtriage" });
  });
});
