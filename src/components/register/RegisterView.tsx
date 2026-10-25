"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import type { EventDraft } from "@/domain/events";
import type { ExtractedFacts } from "@/domain/extraction";
import {
  BLOOD_TYPES,
  FACT_FIELDS,
  INCLUDE_ALL,
  decodeFactsPayload,
  emptyFacts,
  encodeFactsPayload,
  isBloodType,
  type CriticalFacts,
  type FactField,
  type FactInclusion
} from "@/domain/facts";
import { expiryStatus, nextAvailableTag, rollCounts, usableRolls } from "@/domain/inventory";
import { SAMPLE_PATIENT, SAMPLE_RECORD } from "@/domain/samples";
import { buildSummary, type EmsSummary, type RewriterInfo } from "@/domain/summary";
import { encodeTagIdRecord } from "@/domain/tagId";
import { prepareDocumentImage, type PreparedImage } from "@/lib/image";
import { textRecords } from "@/readers/types";
import { nimRewrite } from "@/rewriters/nim";
import { ImageNeedsNimError } from "@/rewriters/types";
import type { ProfileRecord } from "@/store/types";
import { MedProfileCard } from "../capture/MedProfileCard";
import { DemoStickersButton } from "../inventory/DemoStickersButton";
import { Banner } from "../ui/Banner";
import { Button, LinkButton } from "../ui/Button";
import { ByteMeter } from "../ui/ByteMeter";
import { Card } from "../ui/Card";
import { ChipInput } from "../ui/ChipInput";
import { SelectField, TextAreaField, TextField } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { Toggle } from "../ui/Toggle";
import { useAppState } from "../providers/AppDataProvider";
import { useWriter } from "../providers/OperatorProvider";
import { useReader } from "../providers/ReaderProvider";
import { RewriterBadge, SummaryView } from "./SummaryView";

const FIELD_LABELS: Record<FactField, string> = {
  name: "Name",
  birthYear: "Birth year",
  bloodType: "Blood type",
  allergies: "Allergies",
  anticoagulants: "Blood thinners",
  codeStatus: "DNR / POLST",
  conditions: "Conditions",
  contact: "Emergency contact"
};

const PLACEHOLDER_ID = encodeTagIdRecord("XXXX000");

interface RewriteState {
  extracted: ExtractedFacts | null;
  rewriter: RewriterInfo;
  transcript?: string;
}

type Notice = { tone: "success" | "error" | "warning"; title: string; body?: string; tagId?: string } | null;

export function RegisterView() {
  const { state, ready } = useAppState();
  const write = useWriter();
  const { reader, kind, simulator } = useReader();

  const [facts, setFacts] = useState<CriticalFacts>(emptyFacts());
  const [documentText, setDocumentText] = useState("");
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [documentError, setDocumentError] = useState<string>();
  const [rewrite, setRewrite] = useState<RewriteState | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState<string>();
  const [dismissedDnr, setDismissedDnr] = useState(false);
  const [include, setInclude] = useState<FactInclusion>(INCLUDE_ALL);
  const [removed, setRemoved] = useState<{ allergies: string[]; conditions: string[] }>({ allergies: [], conditions: [] });
  const [consent, setConsent] = useState(false);
  const [rollId, setRollId] = useState("");
  const [failNext, setFailNext] = useState(false);
  const [writing, setWriting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const textFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<CriticalFacts>) => setFacts((current) => ({ ...current, ...patch }));

  const summary: EmsSummary | null = useMemo(
    () => (rewrite ? buildSummary(facts, rewrite.extracted, rewrite.rewriter, new Date(), rewrite.transcript) : null),
    [facts, rewrite]
  );
  const merged = summary?.facts ?? facts;
  const onTagFacts: CriticalFacts = useMemo(
    () => ({
      ...merged,
      allergies: merged.allergies.filter((a) => !removed.allergies.includes(a)),
      conditions: merged.conditions.filter((c) => !removed.conditions.includes(c))
    }),
    [merged, removed]
  );

  const rolls = usableRolls(state);
  const roll = state.rolls[rollId] && !state.rolls[rollId].recalled ? state.rolls[rollId] : rolls[0];
  const tag = roll ? nextAvailableTag(roll, state) : undefined;
  const idRecord = tag ? encodeTagIdRecord(tag.tagId) : PLACEHOLDER_ID;
  const encoded = useMemo(() => encodeFactsPayload(onTagFacts, { idRecord, include }), [onTagFacts, idRecord, include]);
  const preview = decodeFactsPayload(encoded.payload);
  const pendingDnr = summary?.pendingConfirmations.includes("dnr") && !dismissedDnr;
  const birthYearError =
    facts.birthYear !== undefined && (facts.birthYear < 1900 || facts.birthYear > new Date().getFullYear()) ? "Enter a year between 1900 and now" : undefined;

  const loadTextFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 200_000) {
      setDocumentError("Text files are limited to 200 KB.");
      return;
    }
    setDocumentText(await file.text());
    setDocumentError(undefined);
  };

  const loadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImageBusy(true);
    setDocumentError(undefined);
    try {
      setImage(await prepareDocumentImage(file));
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : "The image could not be read.");
    } finally {
      setImageBusy(false);
    }
  };

  const runRewriter = async () => {
    setRewriting(true);
    setRewriteError(undefined);
    setDismissedDnr(false);
    try {
      const result = await nimRewrite(documentText, facts, image?.dataUrl);
      setRewrite({ extracted: result.extracted, rewriter: result.rewriter, transcript: result.transcript });
    } catch (error) {
      setRewriteError(error instanceof ImageNeedsNimError ? error.message : error instanceof Error ? error.message : "The rewriter failed.");
    } finally {
      setRewriting(false);
    }
  };

  const writeSticker = async () => {
    if (!roll || !tag) return;
    setWriting(true);
    setNotice(null);
    if (kind === "simulator") simulator.setFailNextWrite(failNext);
    const physical = await reader.write({ records: textRecords([idRecord, encoded.payload]), simulatedTagId: tag.tagId });
    if (!physical.ok) {
      setWriting(false);
      setFailNext(false);
      setNotice({ tone: "error", title: "Sticker not written", body: physical.error });
      return;
    }
    const profileSummary = summary ?? buildSummary(facts, null, { id: "local", fallbackReason: "No medical record provided" }, new Date());
    const drafts: EventDraft[] = [
      ...(tag.encoded ? [] : [{ type: "TagEncoded", payload: { tagId: tag.tagId } } as const]),
      { type: "ProfileRegistered", payload: { tagId: tag.tagId, onTagPayload: encoded.payload, payloadBytes: encoded.bytes, rewriter: rewrite?.rewriter.id ?? "none" } }
    ];
    const result = await write(drafts, {
      profile: (deviceId, at, actor): ProfileRecord => ({
        tagId: tag.tagId,
        facts,
        summary: profileSummary,
        onTagPayload: encoded.payload,
        payloadBytes: encoded.bytes,
        createdAt: at,
        updatedAt: at,
        deviceId,
        actor
      })
    });
    setWriting(false);
    if (result.ok) {
      setConsent(false);
      setNotice({ tone: "success", title: `Sticker ${tag.tagId} written and registered`, body: "Critical facts are on the tag; the full summary stays on this device behind the sticker ID.", tagId: tag.tagId });
    } else {
      setNotice({ tone: "error", title: "Sticker written but not saved", body: `${result.message}. Tap the same sticker again to retry.` });
    }
  };

  const canWrite = Boolean(tag && consent && facts.name.trim() && !birthYearError && !writing);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Register a sticker</h1>
        <p className="mt-3 max-w-2xl text-white/70">
          Set this up before an emergency. Only the facts you approve are written to the sticker, where anyone who taps it can read them. The full summary stays on this device.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <Card
            id="facts"
            title="1 · Person and critical facts"
            action={
              <Button size="sm" icon="user" onClick={() => setFacts(SAMPLE_PATIENT)}>
                Fill sample patient
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Full name" value={facts.name} onChange={(e) => update({ name: e.target.value })} autoComplete="off" required className="sm:col-span-2" />
              <TextField
                label="Birth year"
                type="number"
                inputMode="numeric"
                value={facts.birthYear ?? ""}
                onChange={(e) => update({ birthYear: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="1947"
                error={birthYearError}
              />
              <SelectField label="Blood type" value={facts.bloodType ?? ""} onChange={(e) => update({ bloodType: isBloodType(e.target.value) ? e.target.value : undefined })}>
                <option value="">Unknown</option>
                {BLOOD_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </SelectField>
              <TextField
                label="Emergency contact"
                value={facts.emergencyContact}
                onChange={(e) => update({ emergencyContact: e.target.value })}
                placeholder="Name (relation) phone"
                className="sm:col-span-2"
              />
              <div className="sm:col-span-2">
                <ChipInput label="Allergies" tone="red" values={facts.allergies} onChange={(allergies) => update({ allergies, nkda: allergies.length ? false : facts.nkda })} placeholder="penicillin, latex" />
                <label className="mt-2 inline-flex min-h-[44px] items-center gap-3 text-sm text-white/80">
                  <input type="checkbox" className="h-5 w-5" checked={facts.nkda} disabled={facts.allergies.length > 0} onChange={(e) => update({ nkda: e.target.checked })} />
                  No known allergies (NKDA)
                </label>
              </div>
              <div className="sm:col-span-2">
                <ChipInput label="Conditions" values={facts.conditions} onChange={(conditions) => update({ conditions })} placeholder="atrial fibrillation, diabetes" />
              </div>
            </div>
            <div className="mt-4 divide-y divide-white/10 border-t border-white/10">
              <Toggle label="On blood thinners" description="Anticoagulant or antiplatelet medicine" checked={facts.anticoagulants} onChange={(anticoagulants) => update({ anticoagulants })} tone="thinner" />
              <Toggle label="DNR order" description="Do not resuscitate, confirmed by the owner" checked={facts.dnr} onChange={(dnr) => update({ dnr })} tone="dnr" />
              <Toggle label="POLST on file" description="Physician orders for life-sustaining treatment" checked={facts.polst} onChange={(polst) => update({ polst })} tone="dnr" />
            </div>
          </Card>

          <Card
            id="record"
            title="2 · Medical record"
            description="Paste text, upload a .txt or .md file, or add a photo or scan. Photos are shrunk on this device before upload."
            action={
              <Button size="sm" icon="file" onClick={() => setDocumentText(SAMPLE_RECORD)}>
                Use sample record
              </Button>
            }
            stagger={1}
          >
            <TextAreaField label="Record text" rows={7} value={documentText} onChange={(e) => setDocumentText(e.target.value)} placeholder="Allergies: … Medications: … History: …" />
            <div className="mt-3 flex flex-wrap gap-2">
              <input ref={textFileRef} type="file" accept=".txt,.md,text/plain,text/markdown" className="sr-only" onChange={loadTextFile} aria-label="Upload a text file" />
              <input ref={imageFileRef} type="file" accept="image/jpeg,image/png" capture="environment" className="sr-only" onChange={loadImage} aria-label="Add a photo or scan" />
              <Button size="sm" icon="upload" onClick={() => textFileRef.current?.click()}>
                Upload .txt or .md
              </Button>
              <Button size="sm" icon="camera" onClick={() => imageFileRef.current?.click()} busy={imageBusy}>
                Add photo or scan
              </Button>
            </div>
            {image && (
              <div className="row-surface mt-3 flex items-center gap-3 p-2 pr-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
                <img src={image.dataUrl} alt="Uploaded record preview" className="h-16 w-16 rounded-lg object-cover" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-white">Photo ready for the vision model</p>
                  <p className="text-white/60">
                    {Math.round(image.bytes / 1024)} KB{image.recompressed ? ` (shrunk from ${Math.round(image.originalBytes / 1024)} KB)` : ""} · {image.width}×{image.height}
                  </p>
                </div>
                <Button size="sm" icon="trash" onClick={() => setImage(null)} aria-label="Remove photo">
                  Remove
                </Button>
              </div>
            )}
            {documentError && <Banner tone="error" className="mt-3">{documentError}</Banner>}
          </Card>

          <Card id="rewrite" title="3 · Rewrite for EMS" description="Extracts allergies, medications, conditions, blood thinners and DNR mentions, then ranks what matters first." stagger={2}>
            <Button variant="secondary" icon="sparkles" onClick={runRewriter} busy={rewriting}>
              Run rewriter
            </Button>
            {rewriteError && (
              <Banner tone="warning" title="Nothing was rewritten" className="mt-4">
                {rewriteError}
              </Banner>
            )}
            {summary && (
              <div className="mt-5 space-y-4">
                <RewriterBadge summary={summary} />
                {pendingDnr && (
                  <div className="rounded-2xl bg-dnr/20 p-4 ring-1 ring-inset ring-dnr-ring/40" role="alert">
                    <p className="font-display text-lg font-semibold text-white">The record suggests a DNR order. Confirm?</p>
                    <p className="mt-1 text-sm text-white/75">A DNR flag on the sticker changes what responders do. It is only written if you confirm it matches signed paperwork.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" icon="check" onClick={() => update({ dnr: true })}>
                        Confirm DNR
                      </Button>
                      <Button onClick={() => setDismissedDnr(true)}>Not a DNR</Button>
                    </div>
                  </div>
                )}
                <SummaryView summary={summary} />
              </div>
            )}
          </Card>

          <Card id="write" title="4 · Write the sticker" stagger={3}>
            {ready && rolls.length === 0 ? (
              <div className="space-y-3">
                <p className="text-white/70">No usable sticker rolls. Add one on the Inventory page, or load the demo stickers.</p>
                <DemoStickersButton />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Sticker roll" value={roll?.rollId ?? ""} onChange={(e) => setRollId(e.target.value)}>
                    {rolls.map((r) => (
                      <option key={r.rollId} value={r.rollId}>
                        {r.unit} · {r.batch} ({rollCounts(r, state).remaining} left)
                      </option>
                    ))}
                  </SelectField>
                  <div>
                    <p className="label">Next sticker</p>
                    <p className="row-surface flex min-h-[48px] items-center gap-2 px-4 font-mono">
                      <Icon name="tag" className="h-4 w-4 text-white/60" />
                      {tag ? `${tag.tagId} · ${tag.encoded ? "pre-encoded" : "blank"}` : "None available"}
                    </p>
                  </div>
                </div>
                {roll && expiryStatus(roll, new Date()) !== "ok" && (
                  <Banner tone="warning">This roll&apos;s adhesive is {expiryStatus(roll, new Date()) === "expired" ? "expired" : "close to expiry"}. A wallet sticker should last years.</Banner>
                )}

                <fieldset>
                  <legend className="label">Include on the sticker</legend>
                  <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
                    {FACT_FIELDS.map((field) => (
                      <label key={field} className="inline-flex min-h-[44px] items-center gap-2.5 text-sm text-white/85">
                        <input type="checkbox" className="h-5 w-5" checked={include[field]} onChange={(e) => setInclude({ ...include, [field]: e.target.checked })} />
                        {FIELD_LABELS[field]}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {(merged.allergies.length > 0 || merged.conditions.length > 0) && (
                  <div className="space-y-2">
                    <p className="label">Items going on the sticker (tap to leave one off)</p>
                    <div className="flex flex-wrap gap-2">
                      {(["allergies", "conditions"] as const).flatMap((list) =>
                        merged[list].map((item) => {
                          const off = removed[list].includes(item);
                          return (
                            <button
                              key={`${list}-${item}`}
                              type="button"
                              aria-pressed={!off}
                              onClick={() => setRemoved({ ...removed, [list]: off ? removed[list].filter((i) => i !== item) : [...removed[list], item] })}
                              className={`chip min-h-[40px] text-sm ${off ? "chip-neutral line-through opacity-60" : list === "allergies" ? "chip-red" : "chip-sky"}`}
                            >
                              {item}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                <ByteMeter bytes={encoded.bytes} capacity={encoded.capacity} />
                {(encoded.omitted.allergies > 0 || encoded.omitted.conditions > 0 || encoded.truncated.length > 0) && (
                  <Banner tone="warning" title="Trimmed to fit the sticker">
                    {[
                      encoded.omitted.conditions ? `${encoded.omitted.conditions} condition(s) left off` : "",
                      encoded.omitted.allergies ? `${encoded.omitted.allergies} allergy item(s) left off` : "",
                      encoded.truncated.length ? `${encoded.truncated.join(" and ")} shortened` : ""
                    ]
                      .filter(Boolean)
                      .join("; ")}
                    . Everything stays in the full summary.
                  </Banner>
                )}

                <label className="flex min-h-[52px] items-start gap-3 rounded-2xl bg-white/[0.04] p-4 text-sm text-white/85 ring-1 ring-inset ring-white/10">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span>I approve writing these facts to the sticker. Anyone who taps it can read them.</span>
                </label>

                {kind === "simulator" && (
                  <label className="inline-flex min-h-[44px] items-center gap-3 text-sm text-white/60">
                    <input type="checkbox" className="h-5 w-5" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} />
                    Simulator: fail the next write (shows that no success banner appears)
                  </label>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" icon="nfc" onClick={writeSticker} disabled={!canWrite} busy={writing}>
                    {kind === "web-nfc" ? "Write sticker (hold it to the phone)" : "Write sticker"}
                  </Button>
                  {!facts.name.trim() && <span className="text-sm text-white/55">Add a name first.</span>}
                  {facts.name.trim() && !consent && <span className="text-sm text-white/55">Approve the facts above to write.</span>}
                </div>

                {notice && (
                  <Banner tone={notice.tone} title={notice.title} onDismiss={() => setNotice(null)}>
                    {notice.body}
                    {notice.tagId && (
                      <div className="mt-3">
                        <LinkButton href={`/?tag=${notice.tagId}`} size="sm" icon="arrowRight">
                          Test it on Capture
                        </LinkButton>
                      </div>
                    )}
                  </Banner>
                )}
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-28 lg:self-start" aria-label="Sticker preview">
          <p className="text-sm font-semibold text-white/70">What EMTs will see when they tap it</p>
          {preview && <MedProfileCard facts={preview} tagId={tag?.tagId} preview />}
          <details className="row-surface px-4 py-3 text-sm">
            <summary className="flex min-h-[32px] cursor-pointer items-center font-semibold text-white/75">Raw on-tag payload</summary>
            <code className="mt-2 block break-all font-mono text-xs text-white/70">{idRecord}</code>
            <code className="mt-1 block break-all font-mono text-xs text-white/70">{encoded.payload}</code>
          </details>
        </aside>
      </div>
    </div>
  );
}
