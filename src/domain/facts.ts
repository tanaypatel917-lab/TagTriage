import { NTAG215_CAPACITY, ndefMessageBytes, utf8Length } from "./ndef";

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

export interface CriticalFacts {
  name: string;
  birthYear?: number;
  bloodType?: BloodType;
  allergies: string[];
  nkda: boolean;
  conditions: string[];
  anticoagulants: boolean;
  dnr: boolean;
  polst: boolean;
  emergencyContact: string;
}

export interface OnTagFacts extends CriticalFacts {
  allergiesOmitted: number;
  conditionsOmitted: number;
}

export const FACT_FIELDS = [
  "name",
  "birthYear",
  "bloodType",
  "allergies",
  "anticoagulants",
  "codeStatus",
  "conditions",
  "contact"
] as const;
export type FactField = (typeof FACT_FIELDS)[number];
export type FactInclusion = Record<FactField, boolean>;

export const INCLUDE_ALL: FactInclusion = {
  name: true,
  birthYear: true,
  bloodType: true,
  allergies: true,
  anticoagulants: true,
  codeStatus: true,
  conditions: true,
  contact: true
};

export const FIELD_CAPS = { name: 48, contact: 64, item: 32 } as const;
export const FACTS_PREFIX = "ttf:v1";

export function emptyFacts(): CriticalFacts {
  return {
    name: "",
    allergies: [],
    nkda: false,
    conditions: [],
    anticoagulants: false,
    dnr: false,
    polst: false,
    emergencyContact: ""
  };
}

export function isBloodType(value: unknown): value is BloodType {
  return typeof value === "string" && (BLOOD_TYPES as readonly string[]).includes(value);
}

/** Truncate to at most `maxBytes` of UTF-8 without splitting a code point. */
export function truncateUtf8(text: string, maxBytes: number): string {
  if (utf8Length(text) <= maxBytes) return text;
  let out = "";
  let used = 0;
  for (const char of text) {
    const size = utf8Length(char);
    if (used + size > maxBytes) break;
    out += char;
    used += size;
  }
  return out.trimEnd();
}

export function sanitizeField(text: string, maxBytes: number): string {
  const cleaned = text
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[|;]/g, "/")
    .replace(/\s+/g, " ")
    .trim();
  return truncateUtf8(cleaned, maxBytes);
}

function sanitizeItems(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const clean = sanitizeField(item, FIELD_CAPS.item).replace(/^\++/, "").trim();
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
  }
  return out;
}

function listField(items: string[], omitted: number): string {
  return [...items, ...(omitted > 0 ? [`+${omitted}`] : [])].join(";");
}

function codeStatusField(dnr: boolean, polst: boolean): string {
  if (dnr && polst) return "DNR+POLST";
  if (dnr) return "DNR";
  if (polst) return "POLST";
  return "0";
}

export interface EncodedFacts {
  payload: string;
  bytes: number;
  capacity: number;
  omitted: { allergies: number; conditions: number };
  truncated: ("name" | "contact")[];
}

export interface EncodeOptions {
  idRecord: string;
  capacity?: number;
  include?: FactInclusion;
}

export function encodeFactsPayload(facts: CriticalFacts, options: EncodeOptions): EncodedFacts {
  const capacity = options.capacity ?? NTAG215_CAPACITY;
  const include = options.include ?? INCLUDE_ALL;
  const fullName = include.name ? sanitizeField(facts.name, FIELD_CAPS.name) : "";
  const fullContact = include.contact ? sanitizeField(facts.emergencyContact, FIELD_CAPS.contact) : "";
  let name = fullName;
  let contact = fullContact;
  const allergyItems = sanitizeItems(facts.allergies);
  const allergies = include.allergies
    ? allergyItems.length === 0 && facts.nkda
      ? ["NKDA"]
      : allergyItems
    : [];
  const conditions = include.conditions ? sanitizeItems(facts.conditions) : [];
  const birthYear = include.birthYear && facts.birthYear ? String(facts.birthYear) : "";
  const bloodType = include.bloodType && facts.bloodType ? facts.bloodType : "";
  const anticoagulants = include.anticoagulants ? (facts.anticoagulants ? "1" : "0") : "";
  const codeStatus = include.codeStatus ? codeStatusField(facts.dnr, facts.polst) : "";
  let omittedAllergies = 0;
  let omittedConditions = 0;

  const build = () =>
    [
      FACTS_PREFIX,
      name,
      birthYear,
      bloodType,
      listField(allergies, omittedAllergies),
      anticoagulants,
      codeStatus,
      listField(conditions, omittedConditions),
      contact
    ].join("|");
  const size = () => ndefMessageBytes([options.idRecord, build()]);

  while (size() > capacity && conditions.length > 0) {
    conditions.pop();
    omittedConditions++;
  }
  while (size() > capacity && allergies.length > 0) {
    allergies.pop();
    omittedAllergies++;
  }
  while (size() > capacity && contact) contact = truncateUtf8(contact, utf8Length(contact) - 4);
  while (size() > capacity && name) name = truncateUtf8(name, utf8Length(name) - 4);
  if (size() > capacity) throw new Error("Critical facts cannot fit on this tag");

  const truncated: ("name" | "contact")[] = [];
  if (name !== fullName) truncated.push("name");
  if (contact !== fullContact) truncated.push("contact");
  return {
    payload: build(),
    bytes: size(),
    capacity,
    omitted: { allergies: omittedAllergies, conditions: omittedConditions },
    truncated
  };
}

function splitList(field: string): { items: string[]; omitted: number } {
  const items: string[] = [];
  let omitted = 0;
  for (const part of field.split(";")) {
    const item = part.trim();
    const marker = /^\+(\d+)$/.exec(item);
    if (marker) omitted += Number(marker[1]);
    else if (item) items.push(item);
  }
  return { items, omitted };
}

export function isFactsPayload(text: string): boolean {
  return text.trim().startsWith(`${FACTS_PREFIX}|`);
}

export function decodeFactsPayload(text: string): OnTagFacts | null {
  const parts = text.trim().split("|");
  if (parts.length !== 9 || parts[0] !== FACTS_PREFIX) return null;
  const [, name, birthYear, bloodType, allergyField, anticoagulants, codeStatus, conditionField, contact] = parts;
  const allergies = splitList(allergyField);
  const nkda = allergies.items.length === 1 && allergies.items[0].toUpperCase() === "NKDA";
  const conditions = splitList(conditionField);
  const year = /^\d{4}$/.test(birthYear) ? Number(birthYear) : undefined;
  return {
    name,
    birthYear: year,
    bloodType: isBloodType(bloodType) ? bloodType : undefined,
    allergies: nkda ? [] : allergies.items,
    nkda,
    allergiesOmitted: allergies.omitted,
    anticoagulants: anticoagulants === "1",
    dnr: codeStatus.includes("DNR"),
    polst: codeStatus.includes("POLST"),
    conditions: conditions.items,
    conditionsOmitted: conditions.omitted,
    emergencyContact: contact
  };
}
