"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildMciDrill } from "@/domain/drill";
import { MOVEMENTS, TRIAGE_CATEGORIES, type Triage } from "@/domain/events";
import { decodeFactsPayload } from "@/domain/facts";
import type { AppState, EncounterView } from "@/domain/state";
import { vitalsSummary } from "@/lib/describe";
import { cx, formatElapsed } from "@/lib/format";
import { useProfiles } from "@/store/hooks";
import type { ProfileRecord } from "@/store/types";
import { MovementStepper } from "../capture/EncounterSections";
import { useSectionWrite } from "../capture/useSectionWrite";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Chip, TriageChip } from "../ui/Chip";
import { SelectField } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { useAppState } from "../providers/AppDataProvider";
import { PageIntro } from "../ui/PageIntro";

const COUNTER_STYLE: Record<Triage | "none", string> = {
  RED: "triage-RED",
  YELLOW: "triage-YELLOW",
  GREEN: "triage-GREEN",
  BLACK: "triage-BLACK",
  none: "bg-paper-deep text-fg"
};

function patientName(encounter: EncounterView, state: AppState, profiles: Record<string, ProfileRecord>): string {
  const profile = profiles[encounter.tagId];
  if (profile?.facts.name) return profile.facts.name;
  const payload = state.tags[encounter.tagId]?.onTagPayload;
  const onTag = payload ? decodeFactsPayload(payload)?.name : undefined;
  return onTag || `Unidentified · ${encounter.tagId}`;
}

function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function BoardRow({ encounter, name, now }: { encounter: EncounterView; name: string; now: Date }) {
  const { run, notice, clear, busy } = useSectionWrite();
  const index = MOVEMENTS.indexOf(encounter.movement);
  const next = MOVEMENTS[index + 1];
  const last = encounter.vitals[encounter.vitals.length - 1];
  const locked = Boolean(encounter.custody || encounter.closed);
  return (
    <li className="row-surface p-4">
      <div className="flex flex-wrap items-start gap-3">
        <TriageChip category={encounter.triage?.category} large />
        <div className="min-w-0 flex-1">
          <Link href={`/?encounter=${encounter.encounterId}`} className="inline-flex min-h-[32px] items-center gap-1.5 font-display text-lg font-semibold text-fg underline-offset-4 hover:underline">
            {name} <Icon name="arrowRight" className="h-4 w-4 text-fg/50" />
          </Link>
          <p className="text-sm text-fg/65">{encounter.history.symptoms?.text ?? "No chief complaint yet"}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {encounter.ambulatory && <Chip tone="emerald">Ambulatory</Chip>}
            {encounter.transport && <Chip tone="sky" icon="truck">{encounter.transport.destination}</Chip>}
            {encounter.closed && <Chip>Closed</Chip>}
            {encounter.tagConflict && <Chip tone="red" icon="alert">Sticker conflict</Chip>}
            <Chip icon="clock">{formatElapsed(encounter.opened.at, now)}</Chip>
          </div>
        </div>
        <div className="w-full sm:w-72">
          <MovementStepper movement={encounter.movement} />
          <p className="mt-2 truncate text-xs text-fg/55">{last ? vitalsSummary(last.vitals) : "No vitals yet"}</p>
        </div>
        <div className="flex w-full justify-end sm:w-auto">
          {next && next !== "handed-off" && !locked ? (
            <Button size="sm" icon="truck" busy={busy} onClick={() => run([{ type: "MovementSet", payload: { encounterId: encounter.encounterId, state: next } }], `${name}: ${next}`)}>
              Mark {next}
            </Button>
          ) : next === "handed-off" && !locked ? (
            <Link href={`/?encounter=${encounter.encounterId}#custody`} className="btn btn-ghost btn-sm">
              <Icon name="lock" /> Transfer custody
            </Link>
          ) : null}
        </div>
      </div>
      {notice?.tone === "error" && (
        <Banner tone="error" onDismiss={clear} className="mt-3">
          {notice.text}
        </Banner>
      )}
    </li>
  );
}

export function BoardView() {
  const { state, ready } = useAppState();
  const profiles = useProfiles();
  const now = useNow();
  const { run, notice, clear, busy } = useSectionWrite();
  const [incident, setIncident] = useState("all");
  const [showClosed, setShowClosed] = useState(false);
  const incidents = Object.values(state.incidents);

  const encounters = useMemo(
    () =>
      Object.values(state.encounters)
        .filter((e) => (showClosed ? true : !e.closed))
        .filter((e) => (incident === "all" ? true : incident === "none" ? !e.incidentId : e.incidentId === incident))
        .sort((a, b) => {
          const rank = (e: EncounterView) => (e.triage ? TRIAGE_CATEGORIES.indexOf(e.triage.category) : 4);
          return rank(a) - rank(b) || (a.opened.at < b.opened.at ? -1 : 1);
        }),
    [state.encounters, showClosed, incident]
  );
  const counts = encounters.reduce<Record<Triage | "none", number>>(
    (acc, e) => ({ ...acc, [e.triage?.category ?? "none"]: acc[e.triage?.category ?? "none"] + 1 }),
    { RED: 0, YELLOW: 0, GREEN: 0, BLACK: 0, none: 0 }
  );

  const seedDrill = async () => {
    const drill = buildMciDrill({ seed: Date.now() % 2_147_483_647, now: new Date(), usedRollCodes: Object.values(state.rolls).map((r) => r.rollCode) });
    if (await run(drill.drafts, "MCI drill seeded with 12 patients")) setIncident(drill.incidentId);
  };

  return (
    <div className="space-y-8">
      <PageIntro index="03" kicker="Incident board" title={<>Who is <span className="mark">where</span>.</>} lede={<>Incident tracking: who is where, sorted by triage priority.</>} action={<Button variant="secondary" icon="sparkles" onClick={seedDrill} busy={busy}>
          Seed MCI drill
        </Button>} />
      {notice && (
        <Banner tone={notice.tone} onDismiss={clear}>
          {notice.text}
        </Banner>
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {(["RED", "YELLOW", "GREEN", "BLACK", "none"] as const).map((key) => (
          <div key={key} className={cx("flex min-h-[88px] flex-col justify-between rounded-card border-[1.5px] border-ink px-4 py-3 shadow-[4px_4px_0_#0f1a2a]", COUNTER_STYLE[key])}>
            <span className="text-xs font-bold uppercase tracking-wider opacity-85">{key === "none" ? "Untriaged" : key}</span>
            <span className="font-display text-3xl font-semibold tabular-nums">{counts[key]}</span>
          </div>
        ))}
        <div className="flex min-h-[88px] flex-col justify-between rounded-card border-[1.5px] border-ink bg-paper-card px-4 py-3 text-ink shadow-[4px_4px_0_#d7261e]">
          <span className="text-xs font-bold uppercase tracking-wider opacity-70">Total</span>
          <span className="font-display text-3xl font-semibold tabular-nums">{encounters.length}</span>
        </div>
      </div>

      <Card
        title="Patients"
        action={
          <div className="flex flex-wrap items-end gap-3">
            <SelectField label="Incident" value={incident} onChange={(e) => setIncident(e.target.value)} className="min-w-[14rem]">
              <option value="all">All incidents</option>
              {incidents.map((i) => (
                <option key={i.incidentId} value={i.incidentId}>
                  {i.name}
                </option>
              ))}
              <option value="none">No incident</option>
            </SelectField>
            <label className="inline-flex min-h-[48px] items-center gap-2.5 text-sm text-fg/80">
              <input type="checkbox" className="h-5 w-5" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
              Show closed
            </label>
          </div>
        }
      >
        {ready && encounters.length === 0 ? (
          <p className="text-fg/65">No patients yet. Start an encounter on Capture, or seed the MCI drill.</p>
        ) : (
          <ul className="space-y-3">
            {encounters.map((encounter) => (
              <BoardRow key={encounter.encounterId} encounter={encounter} name={patientName(encounter, state, profiles)} now={now} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
