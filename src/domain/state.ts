import type {
  Disposition,
  HistoryField,
  InterventionCode,
  Movement,
  TagKind,
  TransportPriority,
  Triage,
  Vitals
} from "./events";

export interface Stamp {
  at: string;
  actor: string;
  deviceId: string;
  eventId: string;
}

export type TagState = "available" | "open" | "closed" | "retired" | "registered";

export interface TagView {
  tagId: string;
  rollId?: string;
  index?: number;
  encoded: boolean;
  kind: "unassigned" | TagKind;
  state: TagState;
  activeEncounterId?: string;
  encounterIds: string[];
  foreign: boolean;
  onTagPayload?: string;
  registered?: Stamp;
  retired?: Stamp & { reason: string };
}

export interface RollView {
  rollId: string;
  rollCode: string;
  unit: string;
  batch: string;
  size: number;
  preEncoded: number;
  adhesiveExpiry: string;
  lowStockAt: number;
  added: Stamp;
  recalled: boolean;
  recallReason?: string;
  tagIds: string[];
}

export interface VitalsEntry extends Stamp {
  vitals: Vitals;
  takenAt: string;
}

export interface EncounterView {
  encounterId: string;
  tagId: string;
  tagKind: TagKind;
  incidentId?: string;
  opened: Stamp;
  triage?: Stamp & { category: Triage };
  triageHistory: (Stamp & { category: Triage })[];
  ambulatory: boolean;
  vitals: VitalsEntry[];
  history: Partial<Record<HistoryField, Stamp & { text: string }>>;
  interventions: (Stamp & { code: InterventionCode; note?: string })[];
  transport?: Stamp & { destination: string; priority: TransportPriority; unit?: string };
  movement: Movement;
  movementAt: string;
  custody?: Stamp & { receiver: string; facility: string; note?: string };
  closed?: Stamp & { disposition: Disposition; note?: string };
  tagConflict?: { tagId: string; winner?: string };
  eventIds: string[];
}

export interface IncidentView {
  incidentId: string;
  name: string;
  drill: boolean;
  opened: Stamp;
}

export type ConflictKind =
  | "cross-encounter-claim"
  | "post-custody-write"
  | "write-after-close"
  | "recalled-claim"
  | "invalid-event"
  | "id-mismatch";

export interface Conflict {
  id: string;
  kind: ConflictKind;
  eventId: string;
  stream: string;
  message: string;
  at: string;
  actor: string;
  deviceId: string;
}

export interface AppState {
  rolls: Record<string, RollView>;
  tags: Record<string, TagView>;
  encounters: Record<string, EncounterView>;
  incidents: Record<string, IncidentView>;
  recalledBatches: Record<string, { reason: string; at: string }>;
  conflicts: Conflict[];
  duplicateClaims: number;
}

export function emptyState(): AppState {
  return { rolls: {}, tags: {}, encounters: {}, incidents: {}, recalledBatches: {}, conflicts: [], duplicateClaims: 0 };
}

export function isFrozen(encounter: EncounterView): boolean {
  return encounter.custody !== undefined;
}

export function isRollRecalled(state: AppState, tag: TagView): boolean {
  return tag.rollId !== undefined && state.rolls[tag.rollId]?.recalled === true;
}
