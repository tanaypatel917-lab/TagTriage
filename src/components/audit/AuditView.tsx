"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { EVENT_TYPES, type EventType } from "@/domain/events";
import { decodeFactsPayload } from "@/domain/facts";
import { encounterToFhirBundle } from "@/domain/fhir";
import { sortEvents } from "@/domain/project";
import type { Conflict } from "@/domain/state";
import { describeEvent } from "@/lib/describe";
import { downloadJson, timestampForFile } from "@/lib/download";
import { cx, formatDateTime, plural, shortDevice } from "@/lib/format";
import { getDb } from "@/store/db";
import { useDeviceId, useProfiles } from "@/store/hooks";
import { commitImport, exportBundle, parseExportBundle, previewImport, type ImportPreview } from "@/store/sync";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { SelectField, TextField } from "../ui/Field";
import { useAppState } from "../providers/AppDataProvider";
import { useOperator } from "../providers/OperatorProvider";
import { PageIntro } from "../ui/PageIntro";

const PAGE = 200;
const CONFLICT_LABELS: Record<Conflict["kind"], string> = {
  "cross-encounter-claim": "Sticker claimed by two encounters",
  "post-custody-write": "Write after custody transfer",
  "write-after-close": "Write after encounter closed",
  "recalled-claim": "Recalled sticker used",
  "invalid-event": "Invalid event",
  "id-mismatch": "Same event ID, different content"
};

function ConflictList({ conflicts }: { conflicts: Conflict[] }) {
  return (
    <ul className="space-y-2">
      {conflicts.map((conflict) => (
        <li key={conflict.id} className="rounded-xl bg-amber-500/10 px-4 py-3 ring-1 ring-inset ring-amber-400/20">
          <p className="font-semibold text-amber-900">{CONFLICT_LABELS[conflict.kind]}</p>
          <p className="text-sm text-fg/75">{conflict.message}</p>
          <p className="mt-1 font-mono text-xs text-fg/50">
            {formatDateTime(conflict.at)} · {conflict.actor} · device {shortDevice(conflict.deviceId)} · {conflict.stream}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function AuditView() {
  const { state, events } = useAppState();
  const profiles = useProfiles();
  const deviceId = useDeviceId();
  const { actor } = useOperator();
  const [type, setType] = useState<EventType | "all">("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importNotice, setImportNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [invalidCounts, setInvalidCounts] = useState({ events: 0, profiles: 0 });
  const [merging, setMerging] = useState(false);
  const [encounterId, setEncounterId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const log = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortEvents(events)
      .reverse()
      .filter((event) => type === "all" || event.type === type)
      .filter((event) => !q || event.stream.toLowerCase().includes(q) || event.actor.toLowerCase().includes(q) || describeEvent(event).toLowerCase().includes(q));
  }, [events, type, query]);
  const encounters = Object.values(state.encounters).sort((a, b) => (a.opened.at < b.opened.at ? 1 : -1));

  const exportAll = async () => {
    const bundle = await exportBundle(getDb());
    downloadJson(`tagtriage-${shortDevice(bundle.deviceId)}-${timestampForFile()}.json`, bundle);
  };

  const pickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPreview(null);
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setImportNotice({ tone: "error", text: "That file is not valid JSON." });
      return;
    }
    const parsed = parseExportBundle(json);
    if (!parsed.ok) {
      setImportNotice({ tone: "error", text: parsed.error });
      return;
    }
    setInvalidCounts({ events: parsed.invalidEvents, profiles: parsed.invalidProfiles });
    setPreview(await previewImport(getDb(), parsed.bundle));
    setImportNotice(null);
  };

  const merge = async () => {
    if (!preview) return;
    setMerging(true);
    try {
      const result = await commitImport(getDb(), preview);
      setImportNotice({ tone: "success", text: `Merged ${plural(result.added, "new event")} and ${plural(result.profiles, "profile")}.` });
      setPreview(null);
    } catch (error) {
      setImportNotice({ tone: "error", text: error instanceof Error ? error.message : "Merge failed" });
    } finally {
      setMerging(false);
    }
  };

  const exportFhir = () => {
    const encounter = state.encounters[encounterId];
    if (!encounter) return;
    const profile = profiles[encounter.tagId];
    const payload = state.tags[encounter.tagId]?.onTagPayload;
    const facts = profile?.summary.facts ?? (payload ? decodeFactsPayload(payload) ?? undefined : undefined);
    downloadJson(`tagtriage-fhir-${encounter.encounterId}.json`, encounterToFhirBundle(encounter, facts, new Date()));
  };

  return (
    <div className="space-y-8">
      <PageIntro index="05" kicker="Audit · Sync" title={<>Every write, <span className="mark">on record</span>.</>} lede={<>The append-only event log is the source of truth. Export it, merge another device&apos;s export, or hand an encounter to a hospital as FHIR.</>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="This device" stagger={0}>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-fg/55">Device ID</dt>
              <dd className="break-all font-mono text-fg/90">{deviceId ?? "…"}</dd>
            </div>
            <div>
              <dt className="text-fg/55">Operator</dt>
              <dd className="text-fg/90">{actor}</dd>
            </div>
            <div>
              <dt className="text-fg/55">Stored</dt>
              <dd className="text-fg/90">
                {plural(events.length, "event")} · {plural(Object.keys(profiles).length, "profile")}
              </dd>
            </div>
          </dl>
          <Button className="mt-4 w-full" icon="download" onClick={exportAll}>
            Export JSON
          </Button>
        </Card>

        <Card title="Import and merge" description="Adds events this device hasn't seen. Nothing is overwritten." stagger={1}>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={pickFile} aria-label="Choose an export file" />
          <Button icon="upload" className="w-full" onClick={() => fileRef.current?.click()}>
            Choose export file
          </Button>
          {preview && (
            <div className="mt-4 space-y-3 text-sm">
              <p className="text-fg/80">
                From device <span className="font-mono">{shortDevice(preview.sourceDeviceId)}</span>: {plural(preview.newEvents.length, "new event")}, {preview.duplicates} already here,{" "}
                {plural(preview.profilesToApply.length, "profile")} to apply.
              </p>
              {(invalidCounts.events > 0 || invalidCounts.profiles > 0) && (
                <Banner tone="warning">
                  Skipping {plural(invalidCounts.events, "malformed event")} and {plural(invalidCounts.profiles, "malformed profile")}.
                </Banner>
              )}
              {preview.idMismatches.length > 0 && (
                <Banner tone="warning" title="Integrity mismatch">
                  {plural(preview.idMismatches.length, "event")} share an ID with a different local event and will not be imported.
                </Banner>
              )}
              {preview.newConflicts.length > 0 && (
                <div>
                  <p className="mb-2 font-semibold text-amber-800">This merge will surface {plural(preview.newConflicts.length, "conflict")}:</p>
                  <ConflictList conflicts={preview.newConflicts} />
                </div>
              )}
              <Button variant="secondary" icon="refresh" className="w-full" onClick={merge} busy={merging} disabled={preview.newEvents.length === 0 && preview.profilesToApply.length === 0}>
                Merge into this device
              </Button>
            </div>
          )}
          {importNotice && (
            <Banner tone={importNotice.tone} onDismiss={() => setImportNotice(null)} className="mt-4">
              {importNotice.text}
            </Banner>
          )}
        </Card>

        <Card title="FHIR export" description="FHIR R4-shaped Bundle: Encounter, vitals, procedures, allergies and flags." stagger={2}>
          <SelectField label="Encounter" value={encounterId} onChange={(e) => setEncounterId(e.target.value)}>
            <option value="">Choose an encounter</option>
            {encounters.map((e) => (
              <option key={e.encounterId} value={e.encounterId}>
                {formatDateTime(e.opened.at)} · {e.tagId} · {e.triage?.category ?? "untriaged"}
              </option>
            ))}
          </SelectField>
          <Button className="mt-4 w-full" icon="download" onClick={exportFhir} disabled={!encounterId}>
            Download FHIR bundle
          </Button>
        </Card>
      </div>

      <Card title={`Conflicts (${state.conflicts.length})`} description="Surfaced by the projection, never silently resolved.">
        {state.conflicts.length ? <ConflictList conflicts={state.conflicts} /> : <p className="text-fg/60">No conflicts. Duplicate same-encounter claims merged: {state.duplicateClaims}.</p>}
      </Card>

      <Card title="Event log" description="Actor, device and time on every write. Newest first.">
        <div className="mb-4 grid gap-3 sm:grid-cols-[16rem_1fr]">
          <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value as EventType | "all")}>
            <option value="all">All types</option>
            {EVENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </SelectField>
          <TextField label="Search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sticker ID, actor, stream…" />
        </div>
        <ol className="divide-y divide-fg/[0.07]">
          {log.slice(0, limit).map((event) => (
            <li key={event.id} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr_auto] sm:gap-4">
              <p className="font-mono text-xs tabular-nums text-fg/55">{formatDateTime(event.at)}</p>
              <div className="min-w-0">
                <p className="text-sm text-fg/90">{describeEvent(event)}</p>
                <p className="truncate font-mono text-xs text-fg/45">
                  {event.type} · {event.stream}
                </p>
              </div>
              <p className={cx("text-xs text-fg/60 sm:text-right")}>
                {event.actor}
                <br />
                <Chip className="mt-1">device {shortDevice(event.deviceId)}</Chip>
              </p>
            </li>
          ))}
        </ol>
        {log.length === 0 && <p className="text-fg/60">No events match.</p>}
        {log.length > limit && (
          <Button className="mt-4" onClick={() => setLimit(limit + PAGE)}>
            Show {Math.min(PAGE, log.length - limit)} more
          </Button>
        )}
      </Card>
    </div>
  );
}
