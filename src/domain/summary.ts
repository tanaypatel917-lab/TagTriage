import { SEVERE_ALLERGY, anticoagulantsIn, isHighRiskCondition } from "./dictionaries";
import type { ExtractedFacts } from "./extraction";
import type { CriticalFacts } from "./facts";

export interface MergedFacts extends CriticalFacts {
  medications: string[];
  anticoagulantNames: string[];
  recordSuggestsDnr: boolean;
  warnings: string[];
}

export type AlertLevel = "critical" | "high" | "info";
export type AlertKind =
  | "code-status"
  | "unconfirmed-dnr"
  | "anticoagulant"
  | "allergy"
  | "condition-high"
  | "condition"
  | "medication"
  | "blood-type"
  | "contact"
  | "warning";
export type AlertSource = "manual" | "record" | "both";

export interface EmsAlert {
  id: string;
  rank: number;
  level: AlertLevel;
  kind: AlertKind;
  label: string;
  detail?: string;
  source: AlertSource;
}

export interface RewriterInfo {
  id: "nim" | "local";
  model?: string;
  visionModel?: string;
  fallbackReason?: string;
}

export interface EmsSummary {
  headline: string;
  alerts: EmsAlert[];
  facts: MergedFacts;
  extracted: ExtractedFacts | null;
  rewriter: RewriterInfo;
  pendingConfirmations: "dnr"[];
  generatedAt: string;
  transcript?: string;
}

/** Dedupes case-insensitively, treating "Penicillin (hives)" and "penicillin" as one item and keeping the more detailed text. */
function unionCaseInsensitive(primary: readonly string[], secondary: readonly string[]): string[] {
  const index = new Map<string, number>();
  const out: string[] = [];
  for (const raw of [...primary, ...secondary]) {
    const item = raw.trim();
    const key = item.toLowerCase().replace(/\s*\([^)]*\)/g, "").trim();
    if (!key) continue;
    const existing = index.get(key);
    if (existing === undefined) {
      index.set(key, out.length);
      out.push(item);
    } else if (item.length > out[existing].length) {
      out[existing] = item;
    }
  }
  return out;
}

function sourceOf(manual: readonly string[], record: readonly string[]): AlertSource {
  if (manual.length && record.length) return "both";
  return record.length ? "record" : "manual";
}

/**
 * DNR/POLST come only from the owner's toggles. A record that mentions DNR raises `recordSuggestsDnr`,
 * which must be confirmed explicitly before it can reach the tag.
 */
export function mergeFacts(manual: CriticalFacts, extracted: ExtractedFacts | null): MergedFacts {
  const record: ExtractedFacts = extracted ?? { allergies: [], medications: [], conditions: [], anticoagulants: false, dnr: false };
  const allergies = unionCaseInsensitive(manual.allergies, record.allergies);
  const medications = unionCaseInsensitive([], record.medications);
  const anticoagulantNames = anticoagulantsIn(medications);
  const warnings: string[] = [];
  if (manual.nkda && record.allergies.length > 0) {
    warnings.push("The record lists allergies but “no known allergies” was checked. Allergies were kept.");
  }
  return {
    ...manual,
    allergies,
    nkda: allergies.length === 0 && (manual.nkda || record.nkda === true),
    conditions: unionCaseInsensitive(manual.conditions, record.conditions),
    medications,
    anticoagulants: manual.anticoagulants || record.anticoagulants || anticoagulantNames.length > 0,
    anticoagulantNames,
    recordSuggestsDnr: record.dnr && !manual.dnr,
    warnings
  };
}

export function approxAge(birthYear: number | undefined, now: Date): number | undefined {
  if (!birthYear) return undefined;
  const age = now.getFullYear() - birthYear;
  return age >= 0 && age < 130 ? age : undefined;
}

export function codeStatusLabel(facts: Pick<CriticalFacts, "dnr" | "polst">): string | undefined {
  if (facts.dnr && facts.polst) return "DNR · POLST";
  if (facts.dnr) return "DNR";
  if (facts.polst) return "POLST";
  return undefined;
}

export function allergyLabel(facts: Pick<CriticalFacts, "allergies" | "nkda">): string {
  if (facts.allergies.length) return facts.allergies.join(", ");
  return facts.nkda ? "NKDA" : "none recorded";
}

export function headlineFor(facts: MergedFacts, now: Date): string {
  const age = approxAge(facts.birthYear, now);
  return [
    facts.name.trim() || "Unknown",
    age !== undefined ? `~${age}y` : undefined,
    codeStatusLabel(facts),
    facts.anticoagulants ? "BLOOD THINNERS" : undefined,
    `Allergies: ${allergyLabel(facts)}`
  ]
    .filter(Boolean)
    .join(" · ");
}

export function rankAlerts(facts: MergedFacts, manual: CriticalFacts, extracted: ExtractedFacts | null): EmsAlert[] {
  const record = extracted ?? { allergies: [], medications: [], conditions: [], anticoagulants: false, dnr: false };
  const alerts: Omit<EmsAlert, "rank">[] = [];
  const status = codeStatusLabel(facts);
  if (status) {
    alerts.push({ id: "code-status", level: "critical", kind: "code-status", label: status, detail: "Owner-confirmed code status", source: "manual" });
  }
  if (facts.recordSuggestsDnr) {
    alerts.push({
      id: "unconfirmed-dnr",
      level: "high",
      kind: "unconfirmed-dnr",
      label: "Record mentions DNR (unconfirmed)",
      detail: "Verify paperwork. Not written to the sticker until the owner confirms.",
      source: "record"
    });
  }
  if (facts.anticoagulants) {
    alerts.push({
      id: "anticoagulant",
      level: "critical",
      kind: "anticoagulant",
      label: "On blood thinners",
      detail: facts.anticoagulantNames.length ? facts.anticoagulantNames.join(", ") : undefined,
      source: manual.anticoagulants ? (record.anticoagulants || facts.anticoagulantNames.length ? "both" : "manual") : "record"
    });
  }
  if (facts.allergies.length) {
    const severe = facts.allergies.some((item) => SEVERE_ALLERGY.test(item));
    alerts.push({
      id: "allergy",
      level: "critical",
      kind: "allergy",
      label: `Allergies: ${facts.allergies.join(", ")}`,
      detail: severe ? "History of severe reaction" : undefined,
      source: sourceOf(manual.allergies, record.allergies)
    });
  }
  const high = facts.conditions.filter(isHighRiskCondition);
  const other = facts.conditions.filter((condition) => !isHighRiskCondition(condition));
  if (high.length) {
    alerts.push({ id: "condition-high", level: "high", kind: "condition-high", label: high.join(", "), source: sourceOf(manual.conditions, record.conditions) });
  }
  if (other.length) {
    alerts.push({ id: "condition", level: "info", kind: "condition", label: other.join(", "), source: sourceOf(manual.conditions, record.conditions) });
  }
  if (facts.medications.length) {
    alerts.push({ id: "medication", level: "info", kind: "medication", label: `Medications: ${facts.medications.join(", ")}`, source: "record" });
  }
  if (facts.bloodType) {
    alerts.push({ id: "blood-type", level: "info", kind: "blood-type", label: `Blood type ${facts.bloodType}`, source: "manual" });
  }
  if (facts.emergencyContact.trim()) {
    alerts.push({ id: "contact", level: "info", kind: "contact", label: `Contact: ${facts.emergencyContact.trim()}`, source: "manual" });
  }
  facts.warnings.forEach((warning, index) => {
    alerts.push({ id: `warning-${index}`, level: "high", kind: "warning", label: warning, source: "both" });
  });
  return alerts.map((alert, index) => ({ ...alert, rank: index + 1 }));
}

export function buildSummary(
  manual: CriticalFacts,
  extracted: ExtractedFacts | null,
  rewriter: RewriterInfo,
  now: Date,
  transcript?: string
): EmsSummary {
  const facts = mergeFacts(manual, extracted);
  return {
    headline: headlineFor(facts, now),
    alerts: rankAlerts(facts, manual, extracted),
    facts,
    extracted,
    rewriter,
    pendingConfirmations: facts.recordSuggestsDnr ? ["dnr"] : [],
    generatedAt: now.toISOString(),
    transcript
  };
}
