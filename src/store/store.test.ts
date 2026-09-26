import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { project } from "@/domain/project";
import { SAMPLE_PATIENT } from "@/domain/samples";
import { buildSummary } from "@/domain/summary";
import { rollDraft } from "@/domain/testing";
import { TagTriageDB } from "./db";
import { writeEvents } from "./eventStore";
import { commitImport, exportBundle, parseExportBundle, previewImport } from "./sync";
import type { ProfileRecord } from "./types";

const dbs: TagTriageDB[] = [];
function freshDb(name: string) {
  const db = new TagTriageDB(`${name}-${Math.random()}`);
  dbs.push(db);
  return db;
}

afterEach(async () => {
  await Promise.all(dbs.splice(0).map((db) => db.delete()));
});

function profile(tagId: string, updatedAt: string, name = SAMPLE_PATIENT.name): ProfileRecord {
  const facts = { ...SAMPLE_PATIENT, name };
  return {
    tagId,
    facts,
    summary: buildSummary(facts, null, { id: "local" }, new Date(updatedAt)),
    onTagPayload: "ttf:v1|x|||||0||",
    payloadBytes: 40,
    createdAt: updatedAt,
    updatedAt,
    deviceId: "dev_x",
    actor: "tester"
  };
}

describe("event store", () => {
  it("returns ok:false and appends nothing when a write is rejected", async () => {
    const db = freshDb("reject");
    expect(await writeEvents(db, [rollDraft()], { actor: "a" })).toMatchObject({ ok: true });
    const result = await writeEvents(
      db,
      [
        { type: "EncounterOpened", payload: { encounterId: "enc_1", tagId: "K7QX001", tagKind: "encounter" } },
        { type: "TriageSet", payload: { encounterId: "enc_1", category: "RED" } },
        { type: "VitalsRecorded", payload: { encounterId: "enc_1", vitals: { hr: 999 }, takenAt: new Date().toISOString() } }
      ],
      { actor: "a" }
    );
    expect(result).toMatchObject({ ok: false, code: "invalid" });
    expect(await db.events.count()).toBe(1);
  });

  it("stamps actor, device and a monotonic sequence", async () => {
    const db = freshDb("stamp");
    await writeEvents(db, [rollDraft()], { actor: "EMT A" });
    await writeEvents(
      db,
      [
        { type: "EncounterOpened", payload: { encounterId: "enc_1", tagId: "K7QX001", tagKind: "encounter" } },
        { type: "TriageSet", payload: { encounterId: "enc_1", category: "RED" } }
      ],
      { actor: "EMT B" }
    );
    const events = await db.events.toArray();
    expect(events.map((e) => e.seq).sort()).toEqual([0, 1, 2]);
    expect(new Set(events.map((e) => e.deviceId)).size).toBe(1);
    expect(events.find((e) => e.type === "TriageSet")?.actor).toBe("EMT B");
  });

  it("blocks updates and deletes on the event log", async () => {
    const db = freshDb("append");
    await writeEvents(db, [rollDraft()], { actor: "a" });
    const [event] = await db.events.toArray();
    await expect(db.events.put({ ...event, actor: "changed" })).rejects.toThrow(/append-only/);
    await expect(db.events.delete(event.id)).rejects.toThrow(/append-only/);
    await expect(db.events.clear()).rejects.toThrow(/append-only/);
    expect((await db.events.get(event.id))?.actor).toBe("a");
  });

  it("stores the profile in the same transaction as the registration", async () => {
    const db = freshDb("profile");
    await writeEvents(db, [rollDraft()], { actor: "a" });
    const result = await writeEvents(
      db,
      [{ type: "ProfileRegistered", payload: { tagId: "K7QX001", onTagPayload: "ttf:v1|x|||||0||", payloadBytes: 40, rewriter: "local" } }],
      { actor: "a", profile: (deviceId, at) => ({ ...profile("K7QX001", at), deviceId }) }
    );
    expect(result.ok).toBe(true);
    expect((await db.profiles.get("K7QX001"))?.facts.name).toBe("Margaret Chen");
  });
});

describe("export and import", () => {
  it("reproduces the same projection on a second device and is idempotent", async () => {
    const source = freshDb("source");
    await writeEvents(source, [rollDraft()], { actor: "a" });
    await writeEvents(source, [{ type: "EncounterOpened", payload: { encounterId: "enc_1", tagId: "K7QX001", tagKind: "encounter" } }], { actor: "a" });
    await source.profiles.put(profile("K7QX002", "2026-09-26T10:00:00.000Z"));
    const parsed = parseExportBundle(JSON.parse(JSON.stringify(await exportBundle(source))));
    if (!parsed.ok) throw new Error(parsed.error);

    const target = freshDb("target");
    const preview = await previewImport(target, parsed.bundle);
    expect(preview.newEvents).toHaveLength(2);
    expect(await commitImport(target, preview)).toEqual({ added: 2, profiles: 1 });
    expect(JSON.stringify(project(await target.events.toArray()))).toBe(JSON.stringify(project(await source.events.toArray())));

    const again = await previewImport(target, parsed.bundle);
    expect(again).toMatchObject({ newEvents: [], duplicates: 2, profilesToApply: [] });
  });

  it("applies profiles last-writer-wins", async () => {
    const target = freshDb("lww");
    await target.profiles.put(profile("K7QX002", "2026-09-26T12:00:00.000Z", "Newer"));
    const parsed = parseExportBundle({
      format: "tagtriage.export",
      version: 1,
      events: [],
      profiles: [profile("K7QX002", "2026-09-26T10:00:00.000Z", "Older"), profile("K7QX003", "2026-09-26T10:00:00.000Z")]
    });
    if (!parsed.ok) throw new Error(parsed.error);
    const preview = await previewImport(target, parsed.bundle);
    await commitImport(target, preview);
    expect((await target.profiles.get("K7QX002"))?.facts.name).toBe("Newer");
    expect(await target.profiles.count()).toBe(2);
  });

  it("rejects foreign files and counts invalid events", () => {
    expect(parseExportBundle({ hello: 1 })).toMatchObject({ ok: false });
    expect(parseExportBundle({ format: "tagtriage.export", version: 2, events: [], profiles: [] })).toMatchObject({ ok: false });
    expect(parseExportBundle({ format: "tagtriage.export", version: 1, events: [{ id: "x" }], profiles: [] })).toMatchObject({ ok: true, invalidEvents: 1 });
  });
});
