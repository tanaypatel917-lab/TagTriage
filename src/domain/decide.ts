import { streamFor, type AppEvent, type EventDraft } from "./events";
import { applyEvent } from "./project";
import { validate, type RejectCode } from "./rules";
import type { AppState } from "./state";

export interface StampContext {
  actor: string;
  deviceId: string;
  firstSeq: number;
  now: string;
  newEventId: () => string;
}

export type DecideResult =
  | { ok: true; events: AppEvent[]; state: AppState }
  | { ok: false; code: RejectCode; message: string; index: number };

export function stampDraft(draft: EventDraft, context: StampContext, offset: number): AppEvent {
  return {
    ...draft,
    id: context.newEventId(),
    v: 1,
    at: context.now,
    actor: context.actor,
    deviceId: context.deviceId,
    seq: context.firstSeq + offset,
    stream: streamFor(draft)
  } as AppEvent;
}

/**
 * Validates drafts in order against an evolving copy of `state`. All-or-nothing: the first rejection aborts the batch,
 * and the caller's state is never mutated.
 */
export function decideMany(state: AppState, drafts: readonly EventDraft[], context: StampContext): DecideResult {
  if (drafts.length === 0) return { ok: false, code: "invalid", message: "Nothing to write", index: 0 };
  const working = structuredClone(state);
  const events: AppEvent[] = [];
  for (const [index, draft] of drafts.entries()) {
    const event = stampDraft(draft, context, index);
    const rejection = validate(working, event);
    if (rejection) return { ok: false, ...rejection, index };
    applyEvent(working, event);
    events.push(event);
  }
  return { ok: true, events, state: working };
}
