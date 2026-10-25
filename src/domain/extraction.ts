import { CONDITION_KEYWORDS, anticoagulantsIn } from "./dictionaries";

export interface ExtractedFacts {
  allergies: string[];
  medications: string[];
  conditions: string[];
  anticoagulants: boolean;
  dnr: boolean;
  nkda?: boolean;
}

export const MAX_ITEMS = 25;
export const MAX_ITEM_LENGTH = 80;

const PLACEHOLDERS = new Set(["none", "n/a", "na", "unknown", "nil", "no", "null", "-", "not applicable"]);
const NKDA = /\b(nkda|nka|no known (drug )?allergies)\b/i;

/** Finds the first balanced `{...}` that parses as JSON, ignoring braces inside strings, code fences and prose. */
export function extractFirstJsonObject(text: string): unknown | null {
  for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === "{") depth++;
      else if (char === "}" && --depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  return null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return ["true", "yes", "y", "1"].includes(value.trim().toLowerCase());
  return false;
}

export function cleanList(value: unknown): string[] {
  const raw: unknown[] = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;\n]/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" && typeof item !== "number") continue;
    const text = String(item)
      .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_ITEM_LENGTH)
      .trim();
    const key = text.toLowerCase();
    if (!text || PLACEHOLDERS.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length === MAX_ITEMS) break;
  }
  return out;
}

export function normalizeExtraction(value: unknown): ExtractedFacts | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const allergyList = cleanList(record.allergies);
  const nkda = allergyList.some((item) => NKDA.test(item));
  return {
    allergies: allergyList.filter((item) => !NKDA.test(item)),
    medications: cleanList(record.medications),
    conditions: cleanList(record.conditions),
    anticoagulants: toBoolean(record.anticoagulants),
    dnr: toBoolean(record.dnr),
    nkda: nkda || undefined
  };
}

type Section = "allergies" | "medications" | "conditions" | "codeStatus";

const HEADERS: { section: Section; pattern: RegExp }[] = [
  { section: "allergies", pattern: /^(?:drug\s+)?allerg(?:y|ies)/i },
  { section: "medications", pattern: /^(?:current\s+|home\s+)?(?:medications?|meds|rx)\b/i },
  {
    section: "conditions",
    pattern: /^(?:conditions?|diagnos[ie]s|problem\s+list|problems|pmh|past\s+medical\s+history|medical\s+history|history)\b/i
  },
  { section: "codeStatus", pattern: /^(?:code\s+status|advance\s+directives?|resuscitation\s+status)\b/i }
];

function sectionHeader(line: string): { section: Section; rest: string } | null {
  const stripped = line.replace(/^\s*(?:#+|[-*•])\s*/, "").trim();
  const separator = /[:\-–]/.exec(stripped);
  if (!separator || separator.index > 40) return null;
  const label = stripped.slice(0, separator.index).trim();
  for (const { section, pattern } of HEADERS) {
    if (pattern.test(label) && label.split(/\s+/).length <= 4) return { section, rest: stripped.slice(separator.index + 1).trim() };
  }
  return null;
}

function collectSections(text: string): Partial<Record<Section, string>> {
  const sections: Partial<Record<Section, string>> = {};
  let current: Section | null = null;
  for (const line of text.split(/\r?\n/)) {
    const header = sectionHeader(line);
    if (header) {
      current = header.section;
      sections[current] = [sections[current], header.rest].filter(Boolean).join("\n");
    } else if (!line.trim()) {
      current = null;
    } else if (current) {
      sections[current] = [sections[current], line.trim()].filter(Boolean).join("\n");
    }
  }
  return sections;
}

export function detectDnr(text: string): boolean {
  const positive = /\bDNR\b|\bDNAR\b|do[\s-]+not[\s-]+resuscitate|\bno\s+CPR\b|allow\s+natural\s+death/i.test(text);
  const negated = /\bfull\s+code\b|\bnot\s+(?:a\s+)?DNR\b|\bno\s+DNR\b/i.test(text);
  return positive && !negated;
}

/** Deterministic offline extractor used when NIM is unavailable. */
export function localExtract(text: string): ExtractedFacts {
  const sections = collectSections(text);
  const allergySource = sections.allergies ?? "";
  const nkda = NKDA.test(allergySource) || (!sections.allergies && NKDA.test(text));
  const allergies = cleanList(allergySource.replace(NKDA, ""));
  const medications = cleanList(sections.medications ?? "");
  const conditions = sections.conditions
    ? cleanList(sections.conditions)
    : CONDITION_KEYWORDS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
  const anticoagulants = anticoagulantsIn(medications.length ? medications : [text]).length > 0;
  return {
    allergies,
    medications,
    conditions,
    anticoagulants,
    dnr: detectDnr(sections.codeStatus ?? text),
    nkda: nkda || undefined
  };
}
