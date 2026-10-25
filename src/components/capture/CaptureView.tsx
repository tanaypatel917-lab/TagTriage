"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { classifyRead } from "@/domain/classify";
import type { EventDraft, HistoryField } from "@/domain/events";
import { decodeFactsPayload, type OnTagFacts } from "@/domain/facts";
import { newId } from "@/domain/ids";
import { nextAvailableTag } from "@/domain/inventory";
import { simulatedMemory } from "@/domain/simMemory";
import { isRollRecalled, type AppState, type TagView } from "@/domain/state";
import { encodeTagIdRecord } from "@/domain/tagId";
import { formatTime } from "@/lib/format";
import { textRecords, type TagRead } from "@/readers/types";
import { useProfile } from "@/store/hooks";
import { SummaryView } from "../register/SummaryView";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Icon } from "../ui/Icon";
import { useAppState } from "../providers/AppDataProvider";
import { useWriter } from "../providers/OperatorProvider";
import { useReader } from "../providers/ReaderProvider";
import { EncounterTimeline } from "./EncounterTimeline";
import { CloseSection, CustodySection, HistorySection, InterventionsSection, TransportSection, TriageSection, VitalsSection } from "./EncounterSections";
import { MedProfileCard } from "./MedProfileCard";
import { ReaderPanel } from "./ReaderPanel";
import { PageIntro } from "../ui/PageIntro";

function focusEncounterFor(tag: TagView | undefined): string | undefined {
  if (!tag) return undefined;
  if (tag.activeEncounterId) return tag.activeEncounterId;
  if (tag.kind === "encounter" && (tag.state === "closed" || tag.state === "retired")) return tag.encounterIds[tag.encounterIds.length - 1];
  return undefined;
}

function nextBlankTag(state: AppState): TagView | undefined {
  for (const roll of Object.values(state.rolls)) {
    if (roll.recalled) continue;
    const tag = nextAvailableTag(roll, state);
    if (tag && !tag.encoded) return tag;
  }
  return undefined;
}

export function CaptureView() {
  const { state, events, ready } = useAppState();
  const write = useWriter();
  const { reader } = useReader();
  const params = useSearchParams();
  const [read, setRead] = useState<TagRead | null>(null);
  const [encounterId, setEncounterId] = useState<string>();
  const [scanError, setScanError] = useState<string>();
  const [startError, setStartError] = useState<string>();
  const [starting, setStarting] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const stateRef = useRef(state);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const handledParams = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handleRead = useCallback((next: TagRead) => {
    const current = stateRef.current;
    const cls = classifyRead(next.records.map((r) => r.text), current, next.simulatedTagId);
    setRead(next);
    setScanError(undefined);
    setStartError(undefined);
    const tag = cls.kind === "personal" || cls.kind === "encounter" ? current.tags[cls.tagId] : undefined;
    setEncounterId(focusEncounterFor(tag));
    if (cls.kind === "personal") {
      const f = cls.facts;
      setAnnouncement(
        [`Sticker read: ${f.name || "name not on sticker"}`, f.dnr ? "DNR" : "", f.polst ? "POLST" : "", f.anticoagulants ? "on blood thinners" : "", f.allergies.length ? `allergies ${f.allergies.join(", ")}` : ""]
          .filter(Boolean)
          .join(", ")
      );
    } else {
      setAnnouncement(`Sticker read: ${cls.kind}`);
    }
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      headingRef.current?.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    if (!ready || handledParams.current) return;
    handledParams.current = true;
    const tagParam = params.get("tag");
    const encounterParam = params.get("encounter");
    const encounter = encounterParam ? state.encounters[encounterParam] : undefined;
    const tagId = tagParam ?? encounter?.tagId;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Apply the deep-link scan only after IndexedDB is ready.
    if (tagId) handleRead({ source: "simulator", at: new Date().toISOString(), records: textRecords(simulatedMemory(state, tagId)), simulatedTagId: tagId });
    if (encounter) setEncounterId(encounter.encounterId);
  }, [ready, params, state, handleRead]);

  const cls = useMemo(() => (read ? classifyRead(read.records.map((r) => r.text), state, read.simulatedTagId) : null), [read, state]);
  const tagId = cls && (cls.kind === "personal" || cls.kind === "encounter" || cls.kind === "foreign") ? cls.tagId : cls?.kind === "blank" ? cls.simulatedTagId : undefined;
  const tag = tagId ? state.tags[tagId] : undefined;
  const profile = useProfile(cls?.kind === "personal" ? cls.tagId : undefined);
  const encounter = encounterId ? state.encounters[encounterId] : undefined;
  const onTagFacts: OnTagFacts | null = cls?.kind === "personal" ? cls.facts : encounter && tag?.onTagPayload ? decodeFactsPayload(tag.onTagPayload) : null;

  const startEncounter = async () => {
    if (!cls) return;
    setStarting(true);
    setStartError(undefined);
    const id = newId("enc");
    let drafts: EventDraft[] = [];
    if (cls.kind === "blank") {
      const target = cls.simulatedTagId ? state.tags[cls.simulatedTagId] : nextBlankTag(state);
      if (!target) {
        setStarting(false);
        setStartError("No blank sticker IDs are left in a usable roll.");
        return;
      }
      const written = await reader.write({ records: textRecords([encodeTagIdRecord(target.tagId)]), simulatedTagId: target.tagId });
      if (!written.ok) {
        setStarting(false);
        setStartError(written.error);
        return;
      }
      drafts = [
        { type: "TagEncoded", payload: { tagId: target.tagId } },
        { type: "EncounterOpened", payload: { encounterId: id, tagId: target.tagId, tagKind: "encounter" } }
      ];
    } else if (cls.kind === "personal" || cls.kind === "encounter" || cls.kind === "foreign") {
      drafts = [{ type: "EncounterOpened", payload: { encounterId: id, tagId: cls.tagId, tagKind: cls.kind === "personal" ? "personal" : "encounter" } }];
    }
    const result = await write(drafts);
    setStarting(false);
    if (result.ok) setEncounterId(id);
    else setStartError(result.message);
  };

  const hints: Partial<Record<HistoryField, string>> | undefined = onTagFacts
    ? {
        allergies: onTagFacts.nkda ? "NKDA (per sticker)" : onTagFacts.allergies.join(", ") || undefined,
        medications: profile?.summary.facts.medications.join(", ") || undefined,
        pastHistory: onTagFacts.conditions.join(", ") || undefined
      }
    : undefined;

  const recalled = tag && tag.state === "available" && isRollRecalled(state, tag);
  const canStart =
    cls &&
    !encounter &&
    !recalled &&
    ((cls.kind === "personal" && !tag?.activeEncounterId) ||
      (cls.kind === "encounter" && tag?.state === "available") ||
      cls.kind === "foreign" ||
      (cls.kind === "blank" && (!cls.simulatedTagId || tag?.state === "available")));
  const locked = Boolean(encounter?.custody || encounter?.closed);
  const retireable = Boolean(encounter && encounter.tagKind === "encounter" && !encounter.tagConflict && state.tags[encounter.tagId]?.state !== "retired");

  return (
    <div className="space-y-8">
      <PageIntro index="01" kicker="Capture" title={<>Tap. Read. <span className="mark">Treat.</span></>} lede={<>Tap a sticker to see the patient&apos;s critical facts instantly, then run the encounter. Every entry is timestamped and signed with your operator name.</>} />
      <p className="sr-only" aria-live="assertive">
        {announcement}
      </p>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-6">
          <ReaderPanel onRead={handleRead} onScanError={setScanError} />
          {scanError && <Banner tone="error" title="NFC problem" onDismiss={() => setScanError(undefined)}>{scanError}</Banner>}
          {encounter && (
            <div className="hidden lg:block">
              <EncounterTimeline events={events} encounter={encounter} />
            </div>
          )}
        </div>

        <div ref={panelRef} className="min-w-0 scroll-mt-28 space-y-6">
          {!cls && (
            <WaitingForTap />
          )}

          {cls?.kind === "invalid" && <Banner tone="error" title="Sticker unreadable">{cls.reason} Use a new sticker.</Banner>}
          {cls?.kind === "not-tagtriage" && <Banner tone="warning" title="Not a TagTriage sticker">This tag holds other data. Use a TagTriage sticker.</Banner>}

          {onTagFacts && (
            <MedProfileCard facts={onTagFacts} summary={profile?.summary} tagId={tag?.tagId ?? tagId} source={profile ? "on-tag+lookup" : "on-tag"} headingRef={headingRef} />
          )}
          {cls?.kind === "personal" && tag && isRollRecalled(state, tag) && (
            <Banner tone="warning" title="Sticker from a recalled batch">The facts are readable, but advise the owner to register a replacement sticker.</Banner>
          )}
          {profile && (
            <Card title="Full summary on this device" description="From the profile store, looked up by the sticker ID. Not stored on the tag." instant>
              <SummaryView summary={profile.summary} />
            </Card>
          )}

          {cls && cls.kind !== "invalid" && cls.kind !== "not-tagtriage" && cls.kind !== "personal" && (
            <Card instant title={cls.kind === "blank" ? "Blank sticker" : cls.kind === "foreign" ? `Sticker ${cls.tagId}` : `Encounter sticker ${cls.tagId}`}>
              <h2 ref={onTagFacts ? undefined : headingRef} tabIndex={-1} className="sr-only">
                Sticker details
              </h2>
              <p className="text-fg/75">
                {cls.kind === "blank"
                  ? "This sticker has no ID yet. Starting an encounter writes its opaque ID first. No patient data is written to it."
                  : cls.kind === "foreign"
                    ? "This sticker is not in this device's inventory. You can still track the encounter; it is adopted on first use."
                    : recalled
                      ? "This sticker is from a recalled batch and cannot be used."
                      : tag?.state === "available"
                        ? "Unused first-contact sticker. It carries only an opaque ID."
                        : tag?.state === "retired"
                          ? `Retired at ${tag.retired ? formatTime(tag.retired.at) : "an earlier time"}.`
                          : "No medical profile on this sticker."}
              </p>
              {recalled && <Banner tone="error" title="Recalled batch" className="mt-3">{state.rolls[tag?.rollId ?? ""]?.recallReason}</Banner>}
            </Card>
          )}

          {encounter?.tagConflict && (
            <Banner tone="warning" title="Sticker conflict">
              Another device claimed sticker {encounter.tagConflict.tagId} first ({encounter.tagConflict.winner}). This encounter&apos;s data is kept; reconcile it in Audit·Sync.
            </Banner>
          )}

          {canStart && (
            <div className="space-y-3">
              <Button variant="primary" icon="plus" className="w-full text-lg sm:w-auto" onClick={startEncounter} busy={starting}>
                {cls?.kind === "blank" ? "Encode and start encounter" : "Start encounter"}
              </Button>
              {startError && <Banner tone="error" title="Encounter not started">{startError}</Banner>}
            </div>
          )}

          {encounter && (
            <div key={encounter.encounterId} className="space-y-6">
              {encounter.custody && !encounter.closed && (
                <Banner tone="info" title="Record locked after custody transfer">Only closing the encounter is still allowed.</Banner>
              )}
              <TriageSection encounter={encounter} locked={locked} />
              <VitalsSection encounter={encounter} locked={locked} />
              <InterventionsSection encounter={encounter} locked={locked} />
              <HistorySection encounter={encounter} locked={locked} hints={hints} />
              <TransportSection encounter={encounter} locked={locked} />
              <CustodySection encounter={encounter} locked={Boolean(encounter.closed)} />
              <CloseSection encounter={encounter} retireable={retireable} />
              <div className="lg:hidden">
                <EncounterTimeline events={events} encounter={encounter} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WaitingForTap() {
  return (
    <section aria-labelledby="waiting-title" className="glass-card overflow-hidden p-0">
      <div className="grid items-center gap-6 p-6 sm:grid-cols-[minmax(0,1fr)_13rem] sm:p-8">
        <div>
          <p className="kicker">Reader idle</p>
          <h2 id="waiting-title" className="mt-3 font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-5xl">
            Waiting for a <span className="mark--signal">tap</span>.
          </h2>
          <p className="mt-4 max-w-md text-fg/70">The MED PROFILE appears here the moment a sticker is read. Personal stickers show on-tag facts even on devices that never synced.</p>
          <ol className="mt-6 grid gap-2 font-mono text-[12px] uppercase tracking-[0.12em] text-fg/70 sm:grid-cols-3">
            {["Allergies", "Code status", "Blood thinners"].map((item, index) => (
              <li key={item} className="flex items-center gap-2 border-t-[1.5px] border-ink pt-2">
                <span className="text-signal">{String(index + 1).padStart(2, "0")}</span>
                {item}
              </li>
            ))}
          </ol>
        </div>
        <div className="relative mx-auto grid aspect-square w-44 place-items-center sm:w-full" aria-hidden="true">
          {[0, 900, 1800].map((delay) => (
            <span key={delay} className="tap-ripple" style={{ ["--delay" as string]: `${delay}ms` }} />
          ))}
          <div className="relative grid h-24 w-24 rotate-[-8deg] place-items-center rounded-[20px] border-[1.5px] border-ink bg-signal text-white shadow-[5px_5px_0_#0f1a2a]">
            <Icon name="nfc" className="h-11 w-11" strokeWidth={2} />
          </div>
        </div>
      </div>
      <div className="battenburg battenburg--thin border-t-[1.5px] border-ink" />
    </section>
  );
}
