import { decideMany } from "@/domain/decide";
import type { AppEvent, EventDraft } from "@/domain/events";
import { newId } from "@/domain/ids";
import { project } from "@/domain/project";
import type { RejectCode } from "@/domain/rules";
import type { TagTriageDB } from "./db";
import { getDeviceId } from "./identity";
import type { ProfileRecord } from "./types";

export type WriteResult =
  | { ok: true; events: AppEvent[] }
  | { ok: false; code: RejectCode | "error"; message: string };

export interface WriteOptions {
  actor: string;
  profile?: (deviceId: string, at: string, actor: string) => ProfileRecord;
  now?: Date;
}

/**
 * Validates drafts against the current projection and appends them atomically. Returns `ok: false` (and appends
 * nothing) when any draft is rejected, so callers only show success after a real write.
 */
export async function writeEvents(db: TagTriageDB, drafts: EventDraft[], options: WriteOptions): Promise<WriteResult> {
  try {
    return await db.transaction("rw", db.events, db.meta, db.profiles, async (): Promise<WriteResult> => {
      const deviceId = await getDeviceId(db);
      const seqRow = await db.meta.get("seq");
      const firstSeq = typeof seqRow?.value === "number" ? seqRow.value : 0;
      const now = (options.now ?? new Date()).toISOString();
      const result = decideMany(project(await db.events.toArray()), drafts, {
        actor: options.actor,
        deviceId,
        firstSeq,
        now,
        newEventId: () => newId("ev")
      });
      if (!result.ok) return { ok: false, code: result.code, message: result.message };
      await db.events.bulkAdd(result.events);
      await db.meta.put({ key: "seq", value: firstSeq + result.events.length });
      if (options.profile) await db.profiles.put(options.profile(deviceId, now, options.actor));
      return { ok: true, events: result.events };
    });
  } catch (error) {
    return { ok: false, code: "error", message: error instanceof Error ? error.message : "Write failed" };
  }
}

export function loadEvents(db: TagTriageDB): Promise<AppEvent[]> {
  return db.events.toArray();
}
