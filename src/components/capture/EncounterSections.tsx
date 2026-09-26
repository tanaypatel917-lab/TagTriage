"use client";

import { useState, type FormEvent } from "react";
import {
  DISPOSITIONS,
  HISTORY_FIELDS,
  INTERVENTIONS,
  MOVEMENTS,
  TRANSPORT_PRIORITIES,
  TRIAGE_CATEGORIES,
  type Disposition,
  type EventDraft,
  type HistoryField,
  type Movement,
  type TransportPriority
} from "@/domain/events";
import type { EncounterView } from "@/domain/state";
import { VITAL_KEYS, VITAL_LIMITS, parseVitalsInput, validateVitals, type VitalKey } from "@/domain/vitals";
import { HISTORY_LABELS, vitalsSummary } from "@/lib/describe";
import { cx, formatShortTime, formatTime } from "@/lib/format";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SelectField, TextAreaField, TextField } from "../ui/Field";
import { Toggle } from "../ui/Toggle";
import { useSectionWrite, type SectionNotice } from "./useSectionWrite";

const DESTINATIONS = ["St. Mary Trauma Center", "County General ED", "Riverside Medical Center", "Children's Hospital"];

const TRIAGE_STYLES: Record<string, { tile: string; label: string }> = {
  RED: { tile: "triage-RED", label: "Immediate" },
  YELLOW: { tile: "triage-YELLOW", label: "Delayed" },
  GREEN: { tile: "triage-GREEN", label: "Minor" },
  BLACK: { tile: "triage-BLACK", label: "Expectant / deceased" }
};

function Notice({ notice, onDismiss }: { notice: SectionNotice; onDismiss: () => void }) {
  return notice ? (
    <Banner tone={notice.tone} onDismiss={onDismiss} className="mt-4">
      {notice.text}
    </Banner>
  ) : null;
}

export interface SectionProps {
  encounter: EncounterView;
  locked: boolean;
}

export function TriageSection({ encounter, locked }: SectionProps) {
  const { run, notice, clear, busy } = useSectionWrite();
  const id = encounter.encounterId;
  return (
    <Card id="triage" title="Triage" description="One category at a time. Ambulatory is tracked separately.">
      <fieldset disabled={locked || busy}>
        <legend className="sr-only">Triage category</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TRIAGE_CATEGORIES.map((category) => {
            const selected = encounter.triage?.category === category;
            return (
              <label
                key={category}
                className={cx(
                  "relative flex min-h-[76px] cursor-pointer flex-col justify-center rounded-2xl px-4 py-3 transition-transform duration-150 active:scale-[0.98] has-[:disabled]:cursor-not-allowed has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-white",
                  TRIAGE_STYLES[category].tile,
                  selected ? "ring-4 ring-white shadow-lg" : "opacity-70 hover:opacity-100"
                )}
              >
                <input
                  type="radio"
                  name={`triage-${id}`}
                  value={category}
                  checked={selected}
                  onChange={() => run([{ type: "TriageSet", payload: { encounterId: id, category } }], `Triage set to ${category}`)}
                  className="sr-only"
                />
                <span className="font-display text-xl font-bold tracking-wide">{category}</span>
                <span className="text-sm font-medium opacity-85">{TRIAGE_STYLES[category].label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-3 border-t border-white/10 pt-2">
        <Toggle
          label="Ambulatory"
          description="Patient can walk"
          checked={encounter.ambulatory}
          disabled={locked || busy}
          onChange={(ambulatory) => run([{ type: "AmbulatorySet", payload: { encounterId: id, ambulatory } }], ambulatory ? "Marked ambulatory" : "Marked non-ambulatory")}
        />
      </div>
      <Notice notice={notice} onDismiss={clear} />
    </Card>
  );
}

export function VitalsSection({ encounter, locked }: SectionProps) {
  const { run, notice, clear, busy } = useSectionWrite();
  const [raw, setRaw] = useState<Partial<Record<VitalKey, string>>>({});
  const [touched, setTouched] = useState(false);
  const vitals = parseVitalsInput(raw);
  const check = validateVitals(vitals);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!check.ok) return;
    const ok = await run([{ type: "VitalsRecorded", payload: { encounterId: encounter.encounterId, vitals, takenAt: new Date().toISOString() } }], `Vitals recorded: ${vitalsSummary(vitals)}`);
    if (ok) {
      setRaw({});
      setTouched(false);
    }
  };
  const series = [...encounter.vitals].reverse();
  return (
    <Card id="vitals" title="Vitals" description="Each set is a new timestamped entry. Earlier sets are never edited.">
      <form onSubmit={submit} noValidate>
        <fieldset disabled={locked || busy} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {VITAL_KEYS.map((key) => (
            <TextField
              key={key}
              label={`${VITAL_LIMITS[key].label}${VITAL_LIMITS[key].unit ? ` (${VITAL_LIMITS[key].unit})` : ""}`}
              inputMode={key === "tempF" ? "decimal" : "numeric"}
              value={raw[key] ?? ""}
              onChange={(e) => setRaw({ ...raw, [key]: e.target.value })}
              error={touched || raw[key] ? check.errors[key] : undefined}
              warning={check.warnings[key] ? `${check.warnings[key]} value` : undefined}
              placeholder={`${VITAL_LIMITS[key].min}–${VITAL_LIMITS[key].max}`}
            />
          ))}
        </fieldset>
        {touched && check.errors.form && <p className="mt-2 text-sm font-medium text-red-300">{check.errors.form}</p>}
        <Button type="submit" variant="secondary" icon="activity" className="mt-4" disabled={locked} busy={busy}>
          Record vitals
        </Button>
      </form>
      <Notice notice={notice} onDismiss={clear} />
      {series.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm tabular-nums">
            <caption className="sr-only">Vitals series, newest first</caption>
            <thead className="text-xs uppercase tracking-wider text-white/50">
              <tr>
                <th className="py-2 pr-3 font-semibold">Time</th>
                {["HR", "BP", "RR", "SpO₂", "GCS", "Temp", "BGL", "Pain"].map((h) => (
                  <th key={h} className="px-2 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.map((entry) => {
                const warnings = validateVitals(entry.vitals).warnings;
                const cell = (key: VitalKey) => (
                  <td className={cx("px-2 py-2", warnings[key] ? "font-bold text-amber-300" : "text-white/90")}>{entry.vitals[key] ?? "–"}</td>
                );
                return (
                  <tr key={entry.eventId} className="border-t border-white/10">
                    <td className="py-2 pr-3 text-white/60">{formatShortTime(entry.takenAt)}</td>
                    {cell("hr")}
                    <td className={cx("px-2 py-2", warnings.sbp || warnings.dbp ? "font-bold text-amber-300" : "text-white/90")}>
                      {entry.vitals.sbp !== undefined || entry.vitals.dbp !== undefined ? `${entry.vitals.sbp ?? "?"}/${entry.vitals.dbp ?? "?"}` : "–"}
                    </td>
                    {cell("rr")}
                    {cell("spo2")}
                    {cell("gcs")}
                    {cell("tempF")}
                    {cell("glucose")}
                    {cell("pain")}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function HistorySection({ encounter, locked, hints }: SectionProps & { hints?: Partial<Record<HistoryField, string>> }) {
  const { run, notice, clear, busy } = useSectionWrite();
  const [field, setField] = useState<HistoryField>("symptoms");
  const [text, setText] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await run([{ type: "HistoryNoted", payload: { encounterId: encounter.encounterId, field, text: text.trim() } }], `${HISTORY_LABELS[field]} noted`)) setText("");
  };
  const entries = HISTORY_FIELDS.filter((f) => encounter.history[f]);
  return (
    <Card id="history" title="History (SAMPLE)">
      <form onSubmit={submit}>
        <fieldset disabled={locked || busy} className="grid gap-3 sm:grid-cols-[14rem_1fr]">
          <SelectField label="Field" value={field} onChange={(e) => setField(e.target.value as HistoryField)}>
            {HISTORY_FIELDS.map((f) => (
              <option key={f} value={f}>
                {HISTORY_LABELS[f]}
              </option>
            ))}
          </SelectField>
          <TextAreaField label="Note" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={hints?.[field] ?? "What you observed or were told"} />
        </fieldset>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" icon="clipboard" disabled={locked || !text.trim()} busy={busy}>
            Add note
          </Button>
          {hints?.[field] && !text && (
            <Button onClick={() => setText(hints[field] ?? "")} disabled={locked}>
              Use sticker info
            </Button>
          )}
        </div>
      </form>
      <Notice notice={notice} onDismiss={clear} />
      {entries.length > 0 && (
        <dl className="mt-4 space-y-2">
          {entries.map((f) => (
            <div key={f} className="row-surface px-4 py-2.5">
              <dt className="text-xs font-bold uppercase tracking-wider text-white/50">
                {HISTORY_LABELS[f]} · {formatShortTime(encounter.history[f]?.at ?? "")}
              </dt>
              <dd className="text-white/90">{encounter.history[f]?.text}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

export function InterventionsSection({ encounter, locked }: SectionProps) {
  const { run, notice, clear, busy } = useSectionWrite();
  return (
    <Card id="interventions" title="Interventions" description="One tap logs it with the current time.">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {INTERVENTIONS.map((item) => {
          const done = encounter.interventions.filter((i) => i.code === item.code);
          const last = done[done.length - 1];
          return (
            <button
              key={item.code}
              type="button"
              disabled={locked || busy}
              onClick={() => run([{ type: "InterventionLogged", payload: { encounterId: encounter.encounterId, code: item.code } }], `${item.label} logged at ${formatTime(new Date().toISOString())}`)}
              className={cx(
                "flex min-h-[56px] flex-col items-start justify-center rounded-2xl px-3 py-2 text-left text-sm font-semibold ring-1 ring-inset transition-transform duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50",
                done.length ? "bg-sky-500/15 text-sky-100 ring-sky-400/30" : "bg-white/[0.05] text-white/90 ring-white/10 hover:bg-white/[0.09]"
              )}
            >
              <span>{item.label}</span>
              {last && (
                <span className="text-xs font-medium text-sky-300">
                  ×{done.length} · {formatShortTime(last.at)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <Notice notice={notice} onDismiss={clear} />
    </Card>
  );
}

export function TransportSection({ encounter, locked }: SectionProps) {
  const { run, notice, clear, busy } = useSectionWrite();
  const [destination, setDestination] = useState(encounter.transport?.destination ?? "");
  const [priority, setPriority] = useState<TransportPriority>(encounter.transport?.priority ?? "urgent");
  const [unit, setUnit] = useState(encounter.transport?.unit ?? "");
  const index = MOVEMENTS.indexOf(encounter.movement);
  const next: Movement | undefined = MOVEMENTS[index + 1];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run([{ type: "TransportSet", payload: { encounterId: encounter.encounterId, destination: destination.trim(), priority, unit: unit.trim() || undefined } }], `Transport set to ${destination.trim()}`);
  };
  return (
    <Card id="transport" title="Transport and movement">
      <MovementStepper movement={encounter.movement} />
      {next && next !== "handed-off" && (
        <Button
          className="mt-4"
          icon="truck"
          disabled={locked}
          busy={busy}
          onClick={() => run([{ type: "MovementSet", payload: { encounterId: encounter.encounterId, state: next } }], `Movement: ${next}`)}
        >
          Mark {next}
        </Button>
      )}
      {next === "handed-off" && !locked && <p className="mt-4 text-sm text-white/65">Record the hand-off with a custody transfer below.</p>}
      <form onSubmit={submit} className="mt-5">
        <fieldset disabled={locked || busy} className="grid gap-3 sm:grid-cols-[1fr_12rem_10rem]">
          <TextField label="Destination" list="destinations" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="County General ED" />
          <SelectField label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as TransportPriority)}>
            {TRANSPORT_PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </SelectField>
          <TextField label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Medic 12" />
        </fieldset>
        <datalist id="destinations">
          {DESTINATIONS.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        <Button type="submit" variant="secondary" className="mt-3" icon="truck" disabled={locked || !destination.trim()} busy={busy}>
          Set transport
        </Button>
      </form>
      <Notice notice={notice} onDismiss={clear} />
    </Card>
  );
}

export function MovementStepper({ movement, compact }: { movement: Movement; compact?: boolean }) {
  const index = MOVEMENTS.indexOf(movement);
  return (
    <ol className={cx("flex items-center", compact ? "gap-1" : "gap-1.5")} aria-label={`Movement: ${movement}`}>
      {MOVEMENTS.map((state, i) => (
        <li key={state} className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={cx("h-1.5 rounded-full", i <= index ? (i === index ? "bg-signal" : "bg-white/70") : "bg-white/15")} />
          {!compact && <span className={cx("truncate text-[11px] font-semibold", i === index ? "text-white" : "text-white/45")}>{state}</span>}
        </li>
      ))}
    </ol>
  );
}

export function CustodySection({ encounter, locked }: SectionProps) {
  const { run, notice, clear, busy } = useSectionWrite();
  const [receiver, setReceiver] = useState("");
  const [facility, setFacility] = useState(encounter.transport?.destination ?? "");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  if (encounter.custody) {
    return (
      <Card id="custody" title="Custody transfer">
        <Banner tone="info" title={`Transferred to ${encounter.custody.receiver}, ${encounter.custody.facility}`}>
          At {formatTime(encounter.custody.at)} by {encounter.custody.actor}. The crew record is locked; only closing the encounter is still allowed.
        </Banner>
      </Card>
    );
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await run([{ type: "CustodyTransferred", payload: { encounterId: encounter.encounterId, receiver: receiver.trim(), facility: facility.trim(), note: note.trim() || undefined } }], "Custody transferred. Crew record locked.");
  };
  return (
    <Card id="custody" title="Custody transfer" description="Hands the patient over and locks the crew record against further edits.">
      <form onSubmit={submit}>
        <fieldset disabled={locked || busy} className="grid gap-3 sm:grid-cols-2">
          <TextField label="Receiving clinician" value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder="RN J. Patel" />
          <TextField label="Facility" list="destinations" value={facility} onChange={(e) => setFacility(e.target.value)} placeholder="County General ED" />
          <TextField label="Hand-off note" value={note} onChange={(e) => setNote(e.target.value)} className="sm:col-span-2" placeholder="Optional" />
        </fieldset>
        <label className="mt-3 flex min-h-[44px] items-center gap-3 text-sm text-white/85">
          <input type="checkbox" className="h-5 w-5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={locked} />
          Report given and patient handed over
        </label>
        <Button type="submit" variant="secondary" icon="lock" className="mt-2" disabled={locked || !confirmed || !receiver.trim() || !facility.trim()} busy={busy}>
          Transfer custody
        </Button>
      </form>
      <Notice notice={notice} onDismiss={clear} />
    </Card>
  );
}

export function CloseSection({ encounter, retireable }: { encounter: EncounterView; retireable: boolean }) {
  const { run, notice, clear, busy } = useSectionWrite();
  const [disposition, setDisposition] = useState<Disposition>(encounter.custody ? "transported" : "treated-released");
  const [note, setNote] = useState("");
  const personal = encounter.tagKind === "personal";
  if (encounter.closed) {
    return (
      <Card id="close" title="Encounter closed">
        <Banner tone="info" title={`Closed at ${formatTime(encounter.closed.at)} (${encounter.closed.disposition})`}>
          {personal ? "The personal sticker stays active for future emergencies." : "This encounter is read-only."}
        </Banner>
        {retireable && (
          <Button className="mt-4" icon="trash" busy={busy} onClick={() => run([{ type: "TagRetired", payload: { tagId: encounter.tagId, reason: "Encounter closed" } }], `Sticker ${encounter.tagId} retired`)}>
            Retire sticker {encounter.tagId}
          </Button>
        )}
        <Notice notice={notice} onDismiss={clear} />
      </Card>
    );
  }
  const drafts: EventDraft[] = [
    { type: "EncounterClosed", payload: { encounterId: encounter.encounterId, disposition, note: note.trim() || undefined } },
    ...(retireable ? [{ type: "TagRetired", payload: { tagId: encounter.tagId, reason: "Encounter closed" } } as const] : [])
  ];
  return (
    <Card id="close" title={personal ? "Close encounter" : "Close encounter and retire sticker"} description={personal ? "Personal stickers are never retired; they stay registered for the next emergency." : undefined}>
      <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
        <SelectField label="Disposition" value={disposition} onChange={(e) => setDisposition(e.target.value as Disposition)}>
          {DISPOSITIONS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </SelectField>
        <TextField label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </div>
      <Button className="mt-4" variant="danger" icon="check" busy={busy} onClick={() => run(drafts, retireable ? `Encounter closed and sticker ${encounter.tagId} retired` : "Encounter closed")}>
        {retireable ? "Close and retire sticker" : "Close encounter"}
      </Button>
      <Notice notice={notice} onDismiss={clear} />
    </Card>
  );
}
