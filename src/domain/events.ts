export const TRIAGE_CATEGORIES = ["RED", "YELLOW", "GREEN", "BLACK"] as const;
export type Triage = (typeof TRIAGE_CATEGORIES)[number];

export const MOVEMENTS = ["on-scene", "loaded", "transporting", "arrived", "handed-off"] as const;
export type Movement = (typeof MOVEMENTS)[number];

export const HISTORY_FIELDS = ["symptoms", "allergies", "medications", "pastHistory", "lastIntake", "events"] as const;
export type HistoryField = (typeof HISTORY_FIELDS)[number];

export const INTERVENTIONS = [
  { code: "O2", label: "Oxygen" },
  { code: "IV", label: "IV access" },
  { code: "IO", label: "IO access" },
  { code: "AIRWAY", label: "Airway adjunct" },
  { code: "BVM", label: "BVM ventilation" },
  { code: "CPR", label: "CPR" },
  { code: "AED", label: "AED shock" },
  { code: "TQ", label: "Tourniquet" },
  { code: "BLEED", label: "Bleeding control" },
  { code: "EPI", label: "Epinephrine" },
  { code: "NALOXONE", label: "Naloxone" },
  { code: "ASPIRIN", label: "Aspirin" },
  { code: "NTG", label: "Nitroglycerin" },
  { code: "GLUCOSE", label: "Glucose / D10" },
  { code: "SPLINT", label: "Splint" },
  { code: "SMR", label: "Spinal motion restriction" }
] as const;
export type InterventionCode = (typeof INTERVENTIONS)[number]["code"];

export const DISPOSITIONS = ["transported", "treated-released", "refused", "dead-on-scene", "other"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export const TRANSPORT_PRIORITIES = ["emergent", "urgent", "non-emergent"] as const;
export type TransportPriority = (typeof TRANSPORT_PRIORITIES)[number];

export type TagKind = "encounter" | "personal";
export type RewriterId = "nim" | "local" | "none";

export interface Vitals {
  hr?: number;
  rr?: number;
  sbp?: number;
  dbp?: number;
  spo2?: number;
  gcs?: number;
  tempF?: number;
  glucose?: number;
  pain?: number;
}

export interface EventPayloads {
  RollAdded: {
    rollId: string;
    rollCode: string;
    unit: string;
    batch: string;
    size: number;
    preEncoded: number;
    adhesiveExpiry: string;
    lowStockAt: number;
  };
  BatchRecalled: { batch: string; reason: string };
  TagEncoded: { tagId: string };
  ProfileRegistered: { tagId: string; onTagPayload: string; payloadBytes: number; rewriter: RewriterId };
  EncounterOpened: { encounterId: string; tagId: string; tagKind: TagKind; incidentId?: string };
  TriageSet: { encounterId: string; category: Triage };
  AmbulatorySet: { encounterId: string; ambulatory: boolean };
  VitalsRecorded: { encounterId: string; vitals: Vitals; takenAt: string };
  HistoryNoted: { encounterId: string; field: HistoryField; text: string };
  InterventionLogged: { encounterId: string; code: InterventionCode; note?: string };
  TransportSet: { encounterId: string; destination: string; priority: TransportPriority; unit?: string };
  MovementSet: { encounterId: string; state: Movement };
  CustodyTransferred: { encounterId: string; receiver: string; facility: string; note?: string };
  EncounterClosed: { encounterId: string; disposition: Disposition; note?: string };
  TagRetired: { tagId: string; reason: string };
  IncidentOpened: { incidentId: string; name: string; drill: boolean };
}

export type EventType = keyof EventPayloads;

export interface EventEnvelope<K extends EventType> {
  id: string;
  v: 1;
  type: K;
  at: string;
  actor: string;
  deviceId: string;
  seq: number;
  stream: string;
  payload: EventPayloads[K];
}

export type AppEvent = { [K in EventType]: EventEnvelope<K> }[EventType];
export type EventDraft = { [K in EventType]: { type: K; payload: EventPayloads[K] } }[EventType];
export type EventOf<K extends EventType> = Extract<AppEvent, { type: K }>;

export const ENCOUNTER_EVENT_TYPES = [
  "EncounterOpened",
  "TriageSet",
  "AmbulatorySet",
  "VitalsRecorded",
  "HistoryNoted",
  "InterventionLogged",
  "TransportSet",
  "MovementSet",
  "CustodyTransferred",
  "EncounterClosed"
] as const;

export function streamFor(draft: EventDraft): string {
  switch (draft.type) {
    case "RollAdded":
      return `roll:${draft.payload.rollId}`;
    case "BatchRecalled":
      return `batch:${draft.payload.batch}`;
    case "TagEncoded":
    case "ProfileRegistered":
    case "TagRetired":
      return `tag:${draft.payload.tagId}`;
    case "IncidentOpened":
      return `inc:${draft.payload.incidentId}`;
    default:
      return `enc:${draft.payload.encounterId}`;
  }
}

type FieldKind = "string" | "number" | "boolean" | "object";
const REQUIRED_FIELDS: Record<EventType, Record<string, FieldKind>> = {
  RollAdded: {
    rollId: "string",
    rollCode: "string",
    unit: "string",
    batch: "string",
    size: "number",
    preEncoded: "number",
    adhesiveExpiry: "string",
    lowStockAt: "number"
  },
  BatchRecalled: { batch: "string", reason: "string" },
  TagEncoded: { tagId: "string" },
  ProfileRegistered: { tagId: "string", onTagPayload: "string", payloadBytes: "number", rewriter: "string" },
  EncounterOpened: { encounterId: "string", tagId: "string", tagKind: "string" },
  TriageSet: { encounterId: "string", category: "string" },
  AmbulatorySet: { encounterId: "string", ambulatory: "boolean" },
  VitalsRecorded: { encounterId: "string", vitals: "object", takenAt: "string" },
  HistoryNoted: { encounterId: "string", field: "string", text: "string" },
  InterventionLogged: { encounterId: "string", code: "string" },
  TransportSet: { encounterId: "string", destination: "string", priority: "string" },
  MovementSet: { encounterId: "string", state: "string" },
  CustodyTransferred: { encounterId: "string", receiver: "string", facility: "string" },
  EncounterClosed: { encounterId: "string", disposition: "string" },
  TagRetired: { tagId: "string", reason: "string" },
  IncidentOpened: { incidentId: "string", name: "string", drill: "boolean" }
};

export const EVENT_TYPES = Object.keys(REQUIRED_FIELDS) as EventType[];
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && (EVENT_TYPES as string[]).includes(value);
}

/** Structural check for events arriving from imports. Semantic rules live in rules.ts. */
export function isAppEvent(value: unknown): value is AppEvent {
  if (!isRecord(value)) return false;
  const { id, v, type, at, actor, deviceId, seq, stream, payload } = value;
  if (typeof id !== "string" || !id || v !== 1 || !isEventType(type)) return false;
  if (typeof at !== "string" || !ISO_UTC.test(at)) return false;
  if (typeof actor !== "string" || typeof deviceId !== "string" || !deviceId) return false;
  if (typeof seq !== "number" || !Number.isInteger(seq) || seq < 0) return false;
  if (typeof stream !== "string" || !isRecord(payload)) return false;
  for (const [field, kind] of Object.entries(REQUIRED_FIELDS[type])) {
    const fieldValue = payload[field];
    if (kind === "object" ? !isRecord(fieldValue) : typeof fieldValue !== kind) return false;
  }
  return true;
}
