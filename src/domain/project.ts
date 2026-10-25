import type { AppEvent, EventOf } from "./events";
import { tagIdFor } from "./ids";
import { validate, type Rejection } from "./rules";
import { emptyState, type AppState, type ConflictKind, type EncounterView, type Stamp, type TagView } from "./state";

export function compareEvents(a: AppEvent, b: AppEvent): number {
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  if (a.deviceId !== b.deviceId) return a.deviceId < b.deviceId ? -1 : 1;
  if (a.seq !== b.seq) return a.seq - b.seq;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortEvents(events: readonly AppEvent[]): AppEvent[] {
  return [...events].sort(compareEvents);
}

function stampOf(event: AppEvent): Stamp {
  return { at: event.at, actor: event.actor, deviceId: event.deviceId, eventId: event.id };
}

function newTag(tagId: string, extra: Partial<TagView>): TagView {
  return { tagId, encoded: false, kind: "unassigned", state: "available", encounterIds: [], foreign: false, ...extra };
}

function newEncounter(event: EventOf<"EncounterOpened">, tagConflict?: EncounterView["tagConflict"]): EncounterView {
  const p = event.payload;
  return {
    encounterId: p.encounterId,
    tagId: p.tagId,
    tagKind: p.tagKind,
    incidentId: p.incidentId,
    opened: stampOf(event),
    triageHistory: [],
    ambulatory: false,
    vitals: [],
    history: {},
    interventions: [],
    movement: "on-scene",
    movementAt: event.at,
    tagConflict,
    eventIds: [event.id]
  };
}

const CONFLICT_KINDS: Partial<Record<Rejection["code"], ConflictKind>> = {
  "cross-encounter-claim": "cross-encounter-claim",
  "post-custody-write": "post-custody-write",
  "write-after-close": "write-after-close",
  recalled: "recalled-claim"
};

/** Applies an event that already passed validation. Mutates `state`. */
export function applyEvent(state: AppState, event: AppEvent): void {
  const stamp = stampOf(event);
  switch (event.type) {
    case "RollAdded": {
      const p = event.payload;
      const recall = state.recalledBatches[p.batch];
      const tagIds: string[] = [];
      for (let index = 1; index <= p.size; index++) {
        const tagId = tagIdFor(p.rollCode, index);
        tagIds.push(tagId);
        const existing = state.tags[tagId];
        if (existing) Object.assign(existing, { rollId: p.rollId, index, foreign: false });
        else state.tags[tagId] = newTag(tagId, { rollId: p.rollId, index, encoded: index <= p.preEncoded });
      }
      state.rolls[p.rollId] = {
        ...p,
        added: stamp,
        recalled: recall !== undefined,
        recallReason: recall?.reason,
        tagIds
      };
      return;
    }
    case "BatchRecalled": {
      state.recalledBatches[event.payload.batch] = { reason: event.payload.reason, at: event.at };
      for (const roll of Object.values(state.rolls)) {
        if (roll.batch === event.payload.batch) {
          roll.recalled = true;
          roll.recallReason = event.payload.reason;
        }
      }
      return;
    }
    case "TagEncoded":
      state.tags[event.payload.tagId].encoded = true;
      return;
    case "ProfileRegistered": {
      const tag = state.tags[event.payload.tagId];
      Object.assign(tag, { kind: "personal", state: "registered", onTagPayload: event.payload.onTagPayload, registered: stamp });
      return;
    }
    case "EncounterOpened": {
      const p = event.payload;
      state.encounters[p.encounterId] = newEncounter(event);
      const tag =
        state.tags[p.tagId] ??
        (state.tags[p.tagId] = newTag(p.tagId, { foreign: true, encoded: true, kind: p.tagKind }));
      tag.kind = p.tagKind;
      tag.activeEncounterId = p.encounterId;
      tag.encounterIds.push(p.encounterId);
      if (p.tagKind === "encounter") tag.state = "open";
      else if (tag.state === "available") tag.state = "registered";
      return;
    }
    case "TagRetired": {
      const tag = state.tags[event.payload.tagId];
      tag.state = "retired";
      tag.retired = { ...stamp, reason: event.payload.reason };
      return;
    }
    case "IncidentOpened":
      state.incidents[event.payload.incidentId] = { ...event.payload, opened: stamp };
      return;
    default:
      applyEncounterEvent(state, event, stamp);
  }
}

function applyEncounterEvent(state: AppState, event: AppEvent, stamp: Stamp): void {
  if (!("encounterId" in event.payload)) return;
  const encounter = state.encounters[event.payload.encounterId];
  encounter.eventIds.push(event.id);
  switch (event.type) {
    case "TriageSet": {
      const entry = { ...stamp, category: event.payload.category };
      encounter.triage = entry;
      encounter.triageHistory.push(entry);
      return;
    }
    case "AmbulatorySet":
      encounter.ambulatory = event.payload.ambulatory;
      return;
    case "VitalsRecorded":
      encounter.vitals.push({ ...stamp, vitals: event.payload.vitals, takenAt: event.payload.takenAt });
      return;
    case "HistoryNoted":
      encounter.history[event.payload.field] = { ...stamp, text: event.payload.text };
      return;
    case "InterventionLogged":
      encounter.interventions.push({ ...stamp, code: event.payload.code, note: event.payload.note });
      return;
    case "TransportSet":
      encounter.transport = { ...stamp, destination: event.payload.destination, priority: event.payload.priority, unit: event.payload.unit };
      return;
    case "MovementSet":
      encounter.movement = event.payload.state;
      encounter.movementAt = event.at;
      return;
    case "CustodyTransferred":
      encounter.custody = { ...stamp, receiver: event.payload.receiver, facility: event.payload.facility, note: event.payload.note };
      encounter.movement = "handed-off";
      encounter.movementAt = event.at;
      return;
    case "EncounterClosed": {
      encounter.closed = { ...stamp, disposition: event.payload.disposition, note: event.payload.note };
      const tag = state.tags[encounter.tagId];
      if (!encounter.tagConflict && tag && tag.activeEncounterId === encounter.encounterId) {
        tag.activeEncounterId = undefined;
        if (tag.kind === "encounter") tag.state = "closed";
      }
      return;
    }
  }
}

/** Replays one event during projection: valid events apply, invalid ones become surfaced conflicts. */
export function replayEvent(state: AppState, event: AppEvent): void {
  const rejection = validate(state, event);
  if (!rejection) {
    applyEvent(state, event);
    return;
  }
  if (rejection.code === "duplicate") return;
  if (rejection.code === "duplicate-claim") {
    state.duplicateClaims++;
    return;
  }
  const kind = CONFLICT_KINDS[rejection.code] ?? "invalid-event";
  state.conflicts.push({
    id: `${event.id}:${kind}`,
    kind,
    eventId: event.id,
    stream: event.stream,
    message: rejection.message,
    at: event.at,
    actor: event.actor,
    deviceId: event.deviceId
  });
  if (kind === "cross-encounter-claim" && event.type === "EncounterOpened") {
    const tag = state.tags[event.payload.tagId];
    const winner = tag?.activeEncounterId ?? tag?.encounterIds[0];
    state.encounters[event.payload.encounterId] = newEncounter(event, { tagId: event.payload.tagId, winner });
  }
}

export function project(events: readonly AppEvent[]): AppState {
  const state = emptyState();
  for (const event of sortEvents(events)) replayEvent(state, event);
  return state;
}
