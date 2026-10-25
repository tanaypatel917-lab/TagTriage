import { isAppEvent, type AppEvent } from "@/domain/events";
import { diffConflicts, mergeEventLogs } from "@/domain/merge";
import { project } from "@/domain/project";
import type { Conflict } from "@/domain/state";
import type { TagTriageDB } from "./db";
import { getDeviceId } from "./identity";
import { isProfileRecord, type ProfileRecord } from "./types";

export const EXPORT_FORMAT = "tagtriage.export";
export const EXPORT_VERSION = 1;

export interface ExportBundle {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  deviceId: string;
  events: AppEvent[];
  profiles: ProfileRecord[];
}

export async function exportBundle(db: TagTriageDB, now = new Date()): Promise<ExportBundle> {
  return db.transaction("rw", db.events, db.profiles, db.meta, async () => ({
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    deviceId: await getDeviceId(db),
    events: await db.events.toArray(),
    profiles: await db.profiles.toArray()
  }));
}

export type ParsedBundle =
  | { ok: true; bundle: ExportBundle; invalidEvents: number; invalidProfiles: number }
  | { ok: false; error: string };

export function parseExportBundle(value: unknown): ParsedBundle {
  if (typeof value !== "object" || value === null) return { ok: false, error: "Not a TagTriage export file" };
  const raw = value as Record<string, unknown>;
  if (raw.format !== EXPORT_FORMAT) return { ok: false, error: "Not a TagTriage export file" };
  if (raw.version !== EXPORT_VERSION) return { ok: false, error: `Unsupported export version ${String(raw.version)}` };
  if (!Array.isArray(raw.events) || !Array.isArray(raw.profiles)) return { ok: false, error: "Export is missing events or profiles" };
  const events = raw.events.filter(isAppEvent);
  const profiles = raw.profiles.filter(isProfileRecord);
  return {
    ok: true,
    bundle: {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "",
      deviceId: typeof raw.deviceId === "string" ? raw.deviceId : "unknown",
      events,
      profiles
    },
    invalidEvents: raw.events.length - events.length,
    invalidProfiles: raw.profiles.length - profiles.length
  };
}

export interface ImportPreview {
  sourceDeviceId: string;
  newEvents: AppEvent[];
  duplicates: number;
  idMismatches: string[];
  newConflicts: Conflict[];
  profilesToApply: ProfileRecord[];
  profilesSkipped: number;
}

export async function previewImport(db: TagTriageDB, bundle: ExportBundle): Promise<ImportPreview> {
  const local = await db.events.toArray();
  const report = mergeEventLogs(local, bundle.events);
  const newConflicts = diffConflicts(project(local).conflicts, project([...local, ...report.toAdd]).conflicts);
  const profilesToApply: ProfileRecord[] = [];
  for (const incoming of bundle.profiles) {
    const existing = await db.profiles.get(incoming.tagId);
    if (!existing || incoming.updatedAt > existing.updatedAt) profilesToApply.push(incoming);
  }
  return {
    sourceDeviceId: bundle.deviceId,
    newEvents: report.toAdd,
    duplicates: report.duplicates,
    idMismatches: report.idMismatches.map((m) => m.id),
    newConflicts,
    profilesToApply,
    profilesSkipped: bundle.profiles.length - profilesToApply.length
  };
}

/** Adds only unseen events (original provenance kept) and applies newer profiles (last-writer-wins). */
export async function commitImport(db: TagTriageDB, preview: ImportPreview): Promise<{ added: number; profiles: number }> {
  return db.transaction("rw", db.events, db.profiles, async () => {
    const known = new Set(await db.events.toCollection().primaryKeys());
    const fresh = preview.newEvents.filter((event) => !known.has(event.id));
    await db.events.bulkAdd(fresh);
    let profiles = 0;
    for (const incoming of preview.profilesToApply) {
      const existing = await db.profiles.get(incoming.tagId);
      if (!existing || incoming.updatedAt > existing.updatedAt) {
        await db.profiles.put(incoming);
        profiles++;
      }
    }
    return { added: fresh.length, profiles };
  });
}
