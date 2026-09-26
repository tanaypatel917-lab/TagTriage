import { INTERVENTIONS, type Vitals } from "./events";
import type { CriticalFacts } from "./facts";
import type { EncounterView } from "./state";

export interface FhirResource {
  resourceType: string;
  id: string;
  [key: string]: unknown;
}

export interface FhirBundle {
  resourceType: "Bundle";
  id: string;
  type: "collection";
  timestamp: string;
  entry: { fullUrl: string; resource: FhirResource }[];
}

function fnv1a(input: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Deterministic UUID-shaped id so repeated exports of the same encounter are stable. */
export function uuidFrom(seed: string): string {
  const hex = [0x811c9dc5, 0x01000193, 0x2545f491, 0x9e3779b9]
    .map((salt) => fnv1a(seed, salt).toString(16).padStart(8, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const LOINC = "http://loinc.org";
const VITAL_CODES: { key: keyof Vitals; code: string; display: string; unit: string; ucum: string }[] = [
  { key: "hr", code: "8867-4", display: "Heart rate", unit: "beats/min", ucum: "/min" },
  { key: "rr", code: "9279-1", display: "Respiratory rate", unit: "breaths/min", ucum: "/min" },
  { key: "spo2", code: "59408-5", display: "Oxygen saturation by pulse oximetry", unit: "%", ucum: "%" },
  { key: "tempF", code: "8310-5", display: "Body temperature", unit: "°F", ucum: "[degF]" },
  { key: "glucose", code: "2339-0", display: "Glucose", unit: "mg/dL", ucum: "mg/dL" },
  { key: "gcs", code: "9269-2", display: "Glasgow coma score total", unit: "{score}", ucum: "{score}" },
  { key: "pain", code: "72514-3", display: "Pain severity 0-10", unit: "{score}", ucum: "{score}" }
];

const TRIAGE_PRIORITY: Record<string, string> = { RED: "EM", YELLOW: "UR", GREEN: "R", BLACK: "EL" };

export function encounterToFhirBundle(encounter: EncounterView, profile: CriticalFacts | undefined, now: Date): FhirBundle {
  const ref = (type: string, id: string) => ({ reference: `urn:uuid:${uuidFrom(`${type}:${id}`)}` });
  const entries: FhirResource[] = [];
  const patientId = uuidFrom(`Patient:${encounter.tagId}`);
  const subject = { reference: `urn:uuid:${patientId}` };
  const encounterRef = ref("Encounter", encounter.encounterId);

  entries.push({
    resourceType: "Patient",
    id: patientId,
    identifier: [{ system: "urn:tagtriage:tag", value: encounter.tagId }],
    ...(profile?.name ? { name: [{ text: profile.name }] } : {}),
    ...(profile?.birthYear ? { birthDate: String(profile.birthYear) } : {})
  });

  entries.push({
    resourceType: "Encounter",
    id: uuidFrom(`Encounter:${encounter.encounterId}`),
    identifier: [{ system: "urn:tagtriage:encounter", value: encounter.encounterId }],
    status: encounter.closed ? "finished" : "in-progress",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "EMER", display: "emergency" },
    subject,
    period: { start: encounter.opened.at, ...(encounter.closed ? { end: encounter.closed.at } : {}) },
    ...(encounter.triage
      ? { priority: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ActPriority", code: TRIAGE_PRIORITY[encounter.triage.category] }], text: encounter.triage.category } }
      : {}),
    ...(encounter.transport ? { hospitalization: { destination: { display: encounter.transport.destination } } } : {})
  });

  if (encounter.triage) {
    entries.push({
      resourceType: "Observation",
      id: uuidFrom(`Triage:${encounter.triage.eventId}`),
      status: "final",
      code: { text: "Mass casualty triage category" },
      subject,
      encounter: encounterRef,
      effectiveDateTime: encounter.triage.at,
      valueCodeableConcept: { text: encounter.triage.category }
    });
  }

  for (const entry of encounter.vitals) {
    const base = { status: "final", subject, encounter: encounterRef, effectiveDateTime: entry.takenAt, category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }] };
    for (const vital of VITAL_CODES) {
      const value = entry.vitals[vital.key];
      if (value === undefined) continue;
      entries.push({
        resourceType: "Observation",
        id: uuidFrom(`${vital.key}:${entry.eventId}`),
        ...base,
        code: { coding: [{ system: LOINC, code: vital.code, display: vital.display }] },
        valueQuantity: { value, unit: vital.unit, system: "http://unitsofmeasure.org", code: vital.ucum }
      });
    }
    if (entry.vitals.sbp !== undefined || entry.vitals.dbp !== undefined) {
      entries.push({
        resourceType: "Observation",
        id: uuidFrom(`bp:${entry.eventId}`),
        ...base,
        code: { coding: [{ system: LOINC, code: "85354-9", display: "Blood pressure panel" }] },
        component: [
          ...(entry.vitals.sbp !== undefined ? [{ code: { coding: [{ system: LOINC, code: "8480-6", display: "Systolic blood pressure" }] }, valueQuantity: { value: entry.vitals.sbp, unit: "mmHg" } }] : []),
          ...(entry.vitals.dbp !== undefined ? [{ code: { coding: [{ system: LOINC, code: "8462-4", display: "Diastolic blood pressure" }] }, valueQuantity: { value: entry.vitals.dbp, unit: "mmHg" } }] : [])
        ]
      });
    }
  }

  for (const item of encounter.interventions) {
    entries.push({
      resourceType: "Procedure",
      id: uuidFrom(`Procedure:${item.eventId}`),
      status: "completed",
      code: { text: INTERVENTIONS.find((i) => i.code === item.code)?.label ?? item.code },
      subject,
      encounter: encounterRef,
      performedDateTime: item.at,
      performer: [{ actor: { display: item.actor } }]
    });
  }

  for (const allergy of profile?.allergies ?? []) {
    entries.push({ resourceType: "AllergyIntolerance", id: uuidFrom(`Allergy:${encounter.tagId}:${allergy}`), patient: subject, code: { text: allergy } });
  }
  for (const condition of profile?.conditions ?? []) {
    entries.push({ resourceType: "Condition", id: uuidFrom(`Condition:${encounter.tagId}:${condition}`), subject, code: { text: condition } });
  }
  const flags = [
    ...(profile?.dnr ? ["Do not resuscitate (DNR)"] : []),
    ...(profile?.polst ? ["POLST on file"] : []),
    ...(profile?.anticoagulants ? ["On anticoagulant / antiplatelet therapy"] : [])
  ];
  for (const flag of flags) {
    entries.push({ resourceType: "Flag", id: uuidFrom(`Flag:${encounter.tagId}:${flag}`), status: "active", subject, code: { text: flag } });
  }
  if (encounter.custody) {
    entries.push({
      resourceType: "Provenance",
      id: uuidFrom(`Custody:${encounter.custody.eventId}`),
      target: [encounterRef],
      recorded: encounter.custody.at,
      activity: { text: "Custody transfer" },
      agent: [{ who: { display: encounter.custody.actor } }, { who: { display: `${encounter.custody.receiver}, ${encounter.custody.facility}` } }]
    });
  }

  return {
    resourceType: "Bundle",
    id: uuidFrom(`Bundle:${encounter.encounterId}`),
    type: "collection",
    timestamp: now.toISOString(),
    entry: entries.map((resource) => ({ fullUrl: `urn:uuid:${resource.id}`, resource }))
  };
}
