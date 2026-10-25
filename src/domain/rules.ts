import {
  DISPOSITIONS,
  HISTORY_FIELDS,
  INTERVENTIONS,
  MOVEMENTS,
  TRANSPORT_PRIORITIES,
  TRIAGE_CATEGORIES,
  type AppEvent,
  type EventOf
} from "./events";
import { NTAG215_CAPACITY } from "./ndef";
import { isRollRecalled, type AppState, type EncounterView } from "./state";
import { validateVitals } from "./vitals";

export type RejectCode =
  | "invalid"
  | "duplicate"
  | "duplicate-claim"
  | "cross-encounter-claim"
  | "recalled"
  | "post-custody-write"
  | "write-after-close"
  | "unknown"
  | "not-available";

export interface Rejection {
  code: RejectCode;
  message: string;
}

const MAX_ROLL_SIZE = 500;
const MAX_TEXT = 2000;

function reject(code: RejectCode, message: string): Rejection {
  return { code, message };
}

function blank(text: string | undefined): boolean {
  return !text || !text.trim();
}

function includes<T extends string>(list: readonly T[], value: string): boolean {
  return (list as readonly string[]).includes(value);
}

function validateRollAdded(state: AppState, { payload }: EventOf<"RollAdded">): Rejection | null {
  if (state.rolls[payload.rollId]) return reject("duplicate", "Roll already exists");
  if (!/^[0-9A-Z]{4}$/.test(payload.rollCode)) return reject("invalid", "Roll code must be 4 characters");
  if (blank(payload.unit) || blank(payload.batch)) return reject("invalid", "Unit and batch are required");
  if (!Number.isInteger(payload.size) || payload.size < 1 || payload.size > MAX_ROLL_SIZE) {
    return reject("invalid", `Roll size must be 1–${MAX_ROLL_SIZE}`);
  }
  if (!Number.isInteger(payload.preEncoded) || payload.preEncoded < 0 || payload.preEncoded > payload.size) {
    return reject("invalid", "Pre-encoded count must be between 0 and the roll size");
  }
  if (!Number.isInteger(payload.lowStockAt) || payload.lowStockAt < 0) {
    return reject("invalid", "Low-stock threshold must be 0 or more");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.adhesiveExpiry)) return reject("invalid", "Adhesive expiry must be a date");
  const clash = Object.values(state.rolls).find((roll) => roll.rollCode === payload.rollCode);
  if (clash) return reject("invalid", `Roll code ${payload.rollCode} is already used`);
  return null;
}

function validateEncounterOpened(state: AppState, { payload }: EventOf<"EncounterOpened">): Rejection | null {
  const existing = state.encounters[payload.encounterId];
  if (existing) {
    return existing.tagId === payload.tagId
      ? reject("duplicate-claim", "Encounter already claimed this sticker")
      : reject("invalid", "Encounter ID already used for another sticker");
  }
  if (payload.incidentId && !state.incidents[payload.incidentId]) return reject("unknown", "Unknown incident");
  const tag = state.tags[payload.tagId];
  if (!tag) return null;
  if (tag.state === "available") {
    if (isRollRecalled(state, tag)) return reject("recalled", "Sticker is from a recalled batch. Use another sticker.");
    if (!tag.encoded) return reject("not-available", "Blank sticker must be encoded first");
    if (payload.tagKind !== "encounter") return reject("invalid", "Unregistered stickers open encounter-sticker encounters");
    return null;
  }
  if (tag.state === "registered") {
    if (payload.tagKind !== "personal") return reject("invalid", "Personal stickers open personal encounters");
    if (tag.activeEncounterId) {
      return reject("cross-encounter-claim", `Sticker already has open encounter ${tag.activeEncounterId}`);
    }
    return null;
  }
  const owner = tag.activeEncounterId ?? tag.encounterIds[0];
  return reject("cross-encounter-claim", `Sticker is ${tag.state}${owner ? ` under encounter ${owner}` : ""}`);
}

function validateEncounterWrite(encounter: EncounterView | undefined, event: AppEvent): Rejection | null {
  if (!encounter) return reject("unknown", "Unknown encounter");
  if (encounter.closed) return reject("write-after-close", "Encounter is closed");
  if (event.type !== "EncounterClosed" && encounter.custody) {
    return reject("post-custody-write", `Custody transferred to ${encounter.custody.receiver}; crew record is locked`);
  }
  return null;
}

export function validate(state: AppState, event: AppEvent): Rejection | null {
  switch (event.type) {
    case "RollAdded":
      return validateRollAdded(state, event);
    case "BatchRecalled": {
      if (blank(event.payload.batch) || blank(event.payload.reason)) return reject("invalid", "Batch and reason are required");
      if (state.recalledBatches[event.payload.batch]) return reject("duplicate", "Batch already recalled");
      return null;
    }
    case "TagEncoded": {
      const tag = state.tags[event.payload.tagId];
      if (!tag || tag.foreign) return reject("unknown", "Unknown sticker");
      if (tag.encoded) return reject("duplicate", "Sticker already encoded");
      if (isRollRecalled(state, tag)) return reject("recalled", "Sticker is from a recalled batch");
      return null;
    }
    case "ProfileRegistered": {
      const tag = state.tags[event.payload.tagId];
      if (!tag || tag.foreign) return reject("unknown", "Unknown sticker");
      if (tag.state !== "available" || tag.kind !== "unassigned") return reject("not-available", "Sticker is already in use");
      if (isRollRecalled(state, tag)) return reject("recalled", "Sticker is from a recalled batch. Pick another roll.");
      if (!tag.encoded) return reject("not-available", "Blank sticker must be encoded first");
      if (blank(event.payload.onTagPayload) || event.payload.payloadBytes > NTAG215_CAPACITY) {
        return reject("invalid", "On-tag payload is empty or too large");
      }
      return null;
    }
    case "EncounterOpened":
      return validateEncounterOpened(state, event);
    case "TriageSet":
    case "AmbulatorySet":
    case "VitalsRecorded":
    case "HistoryNoted":
    case "InterventionLogged":
    case "TransportSet":
    case "MovementSet":
    case "CustodyTransferred":
    case "EncounterClosed": {
      const encounter = state.encounters[event.payload.encounterId];
      const base = validateEncounterWrite(encounter, event);
      if (base || !encounter) return base;
      return validateEncounterPayload(encounter, event);
    }
    case "TagRetired": {
      const tag = state.tags[event.payload.tagId];
      if (!tag) return reject("unknown", "Unknown sticker");
      if (tag.kind === "personal") return reject("invalid", "Personal stickers stay active and are never retired here");
      if (tag.state === "retired") return reject("duplicate", "Sticker already retired");
      if (tag.state !== "closed") return reject("not-available", "Close the encounter before retiring the sticker");
      return null;
    }
    case "IncidentOpened": {
      if (state.incidents[event.payload.incidentId]) return reject("duplicate", "Incident already exists");
      if (blank(event.payload.name)) return reject("invalid", "Incident name is required");
      return null;
    }
  }
}

function validateEncounterPayload(encounter: EncounterView, event: AppEvent): Rejection | null {
  switch (event.type) {
    case "TriageSet":
      return includes(TRIAGE_CATEGORIES, event.payload.category) ? null : reject("invalid", "Unknown triage category");
    case "VitalsRecorded": {
      const check = validateVitals(event.payload.vitals);
      if (!check.ok) return reject("invalid", Object.values(check.errors)[0] ?? "Invalid vitals");
      return Number.isNaN(Date.parse(event.payload.takenAt)) ? reject("invalid", "Invalid vitals time") : null;
    }
    case "HistoryNoted":
      if (!includes(HISTORY_FIELDS, event.payload.field)) return reject("invalid", "Unknown history field");
      if (blank(event.payload.text) || event.payload.text.length > MAX_TEXT) return reject("invalid", "History note is empty or too long");
      return null;
    case "InterventionLogged":
      return INTERVENTIONS.some((item) => item.code === event.payload.code) ? null : reject("invalid", "Unknown intervention");
    case "TransportSet":
      if (blank(event.payload.destination)) return reject("invalid", "Destination is required");
      return includes(TRANSPORT_PRIORITIES, event.payload.priority) ? null : reject("invalid", "Unknown transport priority");
    case "MovementSet": {
      if (!includes(MOVEMENTS, event.payload.state)) return reject("invalid", "Unknown movement state");
      if (event.payload.state === "handed-off") return reject("invalid", "Hand-off is recorded by a custody transfer");
      if (MOVEMENTS.indexOf(event.payload.state) <= MOVEMENTS.indexOf(encounter.movement)) {
        return reject("invalid", "Movement can only move forward");
      }
      return null;
    }
    case "CustodyTransferred":
      return blank(event.payload.receiver) || blank(event.payload.facility)
        ? reject("invalid", "Receiver and facility are required")
        : null;
    case "EncounterClosed":
      return includes(DISPOSITIONS, event.payload.disposition) ? null : reject("invalid", "Unknown disposition");
    default:
      return null;
  }
}
