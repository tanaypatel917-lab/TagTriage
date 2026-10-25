"use client";

import { useEffect, useRef, useState } from "react";
import { decodeFactsPayload } from "@/domain/facts";
import { rollTags } from "@/domain/inventory";
import type { TagView } from "@/domain/state";
import { cx } from "@/lib/format";
import type { TagRead } from "@/readers/types";
import { DemoStickersButton } from "../inventory/DemoStickersButton";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { Icon } from "../ui/Icon";
import { useAppState } from "../providers/AppDataProvider";
import { useReader } from "../providers/ReaderProvider";

interface StickerItem {
  tag: TagView;
  label: string;
  hint?: string;
  tone: "red" | "sky" | "emerald" | "amber" | "neutral";
}

function StickerButton({ item, onTap }: { item: StickerItem; onTap: (tagId: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onTap(item.tag.tagId)}
        className="row-surface flex min-h-[52px] w-full items-center gap-3 px-3 text-left transition-colors hover:border-ink hover:bg-hivis/25 active:scale-[0.99]"
        aria-label={`Tap sticker ${item.tag.tagId}: ${item.label}${item.hint ? ` (${item.hint})` : ""}`}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border-[1.5px] border-ink bg-paper-card text-fg">
          <Icon name="nfc" className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-fg">{item.label}</span>
          <span className="block font-mono text-xs text-fg/50">{item.tag.tagId}</span>
        </span>
        {item.hint && <Chip tone={item.tone}>{item.hint}</Chip>}
      </button>
    </li>
  );
}

export function ReaderPanel({ onRead, onScanError }: { onRead: (read: TagRead) => void; onScanError: (message: string) => void }) {
  const { state, ready } = useAppState();
  const { kind, setKind, simulator, reader, webNfcSupported } = useReader();
  const [scanning, setScanning] = useState(false);
  const stopNfc = useRef<(() => void) | null>(null);
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  useEffect(() => simulator.subscribe((read) => onReadRef.current(read)), [simulator]);

  useEffect(() => () => stopNfc.current?.(), []);

  const tags = Object.values(state.tags);
  const personal: StickerItem[] = tags
    .filter((tag) => tag.kind === "personal")
    .map((tag) => ({
      tag,
      label: (tag.onTagPayload && decodeFactsPayload(tag.onTagPayload)?.name) || "Personal sticker",
      hint: tag.activeEncounterId ? "Open encounter" : "Personal",
      tone: tag.activeEncounterId ? "amber" : "sky"
    }));
  const open: StickerItem[] = tags
    .filter((tag) => tag.kind === "encounter" && tag.state === "open")
    .map((tag) => ({ tag, label: "Encounter", hint: "Open", tone: "amber" }));
  const done: StickerItem[] = tags
    .filter((tag) => tag.kind === "encounter" && (tag.state === "closed" || tag.state === "retired"))
    .slice(-3)
    .map((tag) => ({ tag, label: "Used", hint: tag.state === "retired" ? "Retired" : "Closed", tone: "neutral" }));
  const available: { unit: string; recalled: boolean; items: StickerItem[] }[] = Object.values(state.rolls).map((roll) => {
    const free = rollTags(roll, state).filter((tag) => tag.kind === "unassigned" && tag.state === "available");
    const picks = [...free.filter((tag) => tag.encoded).slice(0, roll.recalled ? 1 : 3), ...free.filter((tag) => !tag.encoded).slice(0, 1)];
    return {
      unit: `${roll.unit} · ${roll.batch}`,
      recalled: roll.recalled,
      items: picks.map((tag) => ({
        tag,
        label: tag.encoded ? "Unused" : "Blank",
        hint: roll.recalled ? "Recalled" : tag.encoded ? "Pre-encoded" : "No ID yet",
        tone: roll.recalled ? "red" : "neutral"
      }))
    };
  });

  const startNfc = async () => {
    setScanning(true);
    stopNfc.current?.();
    stopNfc.current = await reader.startScan(
      (read) => onReadRef.current(read),
      (message) => {
        setScanning(false);
        onScanError(message);
      }
    );
  };

  return (
    <Card title="Tap a sticker" description={kind === "simulator" ? "Simulator reader: pick a sticker to tap. No NFC hardware needed." : "Hold the sticker against the back of the phone."}>
      <div role="radiogroup" aria-label="Reader" className="segmented mb-4">
        {(
          [
            { id: "simulator", label: "Simulator", enabled: true },
            { id: "web-nfc", label: "Phone NFC", enabled: webNfcSupported },
            { id: "bridge", label: "Bridge", enabled: false }
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={kind === option.id}
            disabled={!option.enabled}
            onClick={() => setKind(option.id)}
            title={option.id === "bridge" ? "Bridge interface available; no reader connected" : option.enabled ? undefined : "Web NFC needs Android Chrome over HTTPS"}
            className="nav-pill disabled:cursor-not-allowed disabled:opacity-40"
          >
            {option.label}
          </button>
        ))}
      </div>

      {kind === "web-nfc" ? (
        <button type="button" onClick={startNfc} className="btn btn-secondary w-full" disabled={scanning}>
          <Icon name="nfc" /> {scanning ? "Listening for a sticker…" : "Start NFC scan"}
        </button>
      ) : ready && tags.length === 0 ? (
        <div className="space-y-3">
          <p className="text-fg/70">No stickers yet.</p>
          <DemoStickersButton />
        </div>
      ) : (
        <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-1">
          {[
            { title: "Personal stickers", items: personal },
            { title: "Open encounters", items: open }
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <div key={group.title}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-fg/55">{group.title}</h3>
                <ul className="space-y-2">
                  {group.items.map((item) => (
                    <StickerButton key={item.tag.tagId} item={item} onTap={(id) => simulator.tap(id)} />
                  ))}
                </ul>
              </div>
            ))}
          {available
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <div key={group.unit}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-fg/55">{group.unit}</h3>
                <ul className="space-y-2">
                  {group.items.map((item) => (
                    <StickerButton key={item.tag.tagId} item={item} onTap={(id) => simulator.tap(id)} />
                  ))}
                </ul>
              </div>
            ))}
          {done.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-fg/55">Recently used</h3>
              <ul className="space-y-2">
                {done.map((item) => (
                  <StickerButton key={item.tag.tagId} item={item} onTap={(id) => simulator.tap(id)} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
