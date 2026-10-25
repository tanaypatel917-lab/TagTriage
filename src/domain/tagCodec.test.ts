import { describe, expect, it } from "vitest";
import { decodeFactsPayload, emptyFacts, encodeFactsPayload, sanitizeField, truncateUtf8, type CriticalFacts } from "./facts";
import { newId, tagIdFor, toCrockford } from "./ids";
import { NTAG215_CAPACITY, ndefMessageBytes, textRecordBytes } from "./ndef";
import { encodeTagIdRecord, parseTagIdRecord } from "./tagId";

const margaret: CriticalFacts = {
  name: "Margaret Chen",
  birthYear: 1947,
  bloodType: "A+",
  allergies: ["penicillin", "latex"],
  nkda: false,
  conditions: ["atrial fibrillation", "type 2 diabetes"],
  anticoagulants: true,
  dnr: true,
  polst: false,
  emergencyContact: "David Chen (son) 555-0142"
};
const idRecord = encodeTagIdRecord("K7QX017");

describe("ids", () => {
  it("encodes Crockford base32 and builds sticker ids", () => {
    expect(toCrockford(new Uint8Array([0, 0, 0, 0, 0]))).toBe("00000000");
    expect(toCrockford(new Uint8Array([255]))).toBe("ZW");
    expect(newId("ev")).toMatch(/^ev_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(tagIdFor("K7QX", 17)).toBe("K7QX017");
  });
});

describe("opaque tag id record", () => {
  it("round-trips and carries a CRC", () => {
    expect(idRecord).toMatch(/^tt:v1:K7QX017:[0-9A-F]{4}$/);
    expect(parseTagIdRecord(idRecord)).toEqual({ ok: true, tagId: "K7QX017" });
  });

  it("rejects tampering, bad versions and garbage", () => {
    expect(parseTagIdRecord(idRecord.replace("K7QX017", "K7QX018"))).toEqual({ ok: false, reason: "checksum" });
    expect(parseTagIdRecord("tt:v2:K7QX017:0000")).toEqual({ ok: false, reason: "version" });
    expect(parseTagIdRecord("hello")).toEqual({ ok: false, reason: "format" });
    expect(parseTagIdRecord("tt:v1:k7qx017:0000")).toEqual({ ok: false, reason: "format" });
  });
});

describe("NDEF sizing", () => {
  it("counts short and long text records", () => {
    expect(textRecordBytes("hi")).toBe(9);
    expect(textRecordBytes("a".repeat(252))).toBe(1 + 1 + 1 + 1 + 255);
    expect(textRecordBytes("a".repeat(253))).toBe(1 + 1 + 4 + 1 + 256);
  });

  it("adds TLV framing with a 3-byte length past 254 bytes", () => {
    expect(ndefMessageBytes(["hi"])).toBe(12);
    const long = "a".repeat(300);
    expect(ndefMessageBytes([long])).toBe(1 + 3 + textRecordBytes(long) + 1);
  });
});

describe("sanitizing", () => {
  it("replaces delimiters, strips control chars and collapses whitespace", () => {
    expect(sanitizeField(" peanut |  tree;nut\u0007 ", 32)).toBe("peanut / tree/nut");
  });

  it("never splits a multi-byte code point", () => {
    expect(truncateUtf8("José Ñúñez", 4)).toBe("Jos");
    expect(truncateUtf8("😀😀", 5)).toBe("😀");
  });
});

describe("facts payload", () => {
  it("encodes the spec format and decodes it back", () => {
    const encoded = encodeFactsPayload(margaret, { idRecord });
    expect(encoded.payload).toBe(
      "ttf:v1|Margaret Chen|1947|A+|penicillin;latex|1|DNR|atrial fibrillation;type 2 diabetes|David Chen (son) 555-0142"
    );
    expect(encoded.bytes).toBe(ndefMessageBytes([idRecord, encoded.payload]));
    const decoded = decodeFactsPayload(encoded.payload);
    expect(decoded).toMatchObject({ ...margaret, allergiesOmitted: 0, conditionsOmitted: 0 });
  });

  it("writes NKDA only when no allergies are listed", () => {
    const nkda = encodeFactsPayload({ ...emptyFacts(), name: "A", nkda: true }, { idRecord });
    expect(nkda.payload.split("|")[4]).toBe("NKDA");
    expect(decodeFactsPayload(nkda.payload)).toMatchObject({ nkda: true, allergies: [] });
    expect(encodeFactsPayload({ ...emptyFacts(), allergies: [], nkda: false }, { idRecord }).payload.split("|")[4]).toBe("");
  });

  it("sanitizes delimiters inside list items so the payload stays parseable", () => {
    const encoded = encodeFactsPayload({ ...margaret, allergies: ["sulfa|bactrim", "+2", "iodine;contrast"] }, { idRecord });
    expect(decodeFactsPayload(encoded.payload)?.allergies).toEqual(["sulfa/bactrim", "2", "iodine/contrast"]);
  });

  it("never exceeds the 504-byte tag and drops conditions before allergies", () => {
    const huge: CriticalFacts = {
      ...margaret,
      name: "Ñ".repeat(200),
      allergies: Array.from({ length: 200 }, (_, i) => `allergen-${i}-${"x".repeat(20)}`),
      conditions: Array.from({ length: 200 }, (_, i) => `condition-${i}`),
      emergencyContact: "c".repeat(200)
    };
    const encoded = encodeFactsPayload(huge, { idRecord });
    expect(encoded.bytes).toBeLessThanOrEqual(NTAG215_CAPACITY);
    expect(ndefMessageBytes([idRecord, encoded.payload])).toBe(encoded.bytes);
    const decoded = decodeFactsPayload(encoded.payload);
    expect(decoded?.conditions).toEqual([]);
    expect(decoded?.conditionsOmitted).toBe(200);
    expect(decoded?.allergies.length).toBeGreaterThan(0);
    expect(decoded?.allergiesOmitted).toBe(200 - (decoded?.allergies.length ?? 0));
    expect(decoded?.dnr).toBe(true);
    expect(decoded?.anticoagulants).toBe(true);
  });

  it("honors per-field inclusion", () => {
    const encoded = encodeFactsPayload(margaret, {
      idRecord,
      include: { name: false, birthYear: true, bloodType: true, allergies: true, anticoagulants: true, codeStatus: true, conditions: false, contact: false }
    });
    expect(encoded.payload).toBe("ttf:v1||1947|A+|penicillin;latex|1|DNR||");
  });

  it("rejects payloads that are not ttf:v1", () => {
    expect(decodeFactsPayload("ttf:v2|a|b")).toBeNull();
    expect(decodeFactsPayload("hello")).toBeNull();
  });
});
