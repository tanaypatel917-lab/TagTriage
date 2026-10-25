import type { AppEvent } from "@/domain/events";
import type { EncounterView } from "@/domain/state";
import { describeEvent } from "@/lib/describe";
import { formatTime, shortDevice } from "@/lib/format";
import { Card } from "../ui/Card";

export function encounterEvents(events: readonly AppEvent[], encounter: EncounterView): AppEvent[] {
  return events
    .filter((event) => event.stream === `enc:${encounter.encounterId}` || (event.stream === `tag:${encounter.tagId}` && event.at >= encounter.opened.at && event.type === "TagRetired"))
    .sort((a, b) => (a.at === b.at ? a.seq - b.seq : a.at < b.at ? -1 : 1));
}

export function EncounterTimeline({ events, encounter }: { events: readonly AppEvent[]; encounter: EncounterView }) {
  const items = encounterEvents(events, encounter);
  return (
    <Card title="Encounter timeline" description="Every write is an immutable, timestamped event." instant>
      <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-white/15">
        {items.map((event) => (
          <li key={event.id} className="relative pl-6">
            <span className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-navy-900 bg-signal" aria-hidden="true" />
            <p className="font-mono text-xs tabular-nums text-white/55">{formatTime(event.at)}</p>
            <p className="text-sm font-medium text-white/90">{describeEvent(event)}</p>
            <p className="text-xs text-white/50">
              {event.actor} · device {shortDevice(event.deviceId)}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
