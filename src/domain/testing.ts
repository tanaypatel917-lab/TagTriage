import { decideMany, type DecideResult } from "./decide";
import type { AppEvent, EventDraft } from "./events";
import { project } from "./project";

/** Test helper: an in-memory device that appends validated events to a shared or private log. */
export class TestDevice {
  readonly log: AppEvent[];
  private seq = 0;
  private counter = 0;
  private minute = 0;

  constructor(
    readonly deviceId: string,
    log: AppEvent[] = [],
    private readonly baseTime = Date.parse("2026-09-26T12:00:00.000Z")
  ) {
    this.log = log;
  }

  state() {
    return project(this.log);
  }

  write(drafts: EventDraft[], options: { minute?: number; actor?: string } = {}): DecideResult {
    if (options.minute !== undefined) this.minute = options.minute;
    const result = decideMany(this.state(), drafts, {
      actor: options.actor ?? `EMT ${this.deviceId}`,
      deviceId: this.deviceId,
      firstSeq: this.seq,
      now: new Date(this.baseTime + this.minute * 60_000).toISOString(),
      newEventId: () => `ev_${this.deviceId}_${this.counter++}`
    });
    if (result.ok) {
      this.log.push(...result.events);
      this.seq += result.events.length;
      this.minute++;
    }
    return result;
  }

  mustWrite(drafts: EventDraft[], options?: { minute?: number; actor?: string }): AppEvent[] {
    const result = this.write(drafts, options);
    if (!result.ok) throw new Error(`Write rejected: ${result.message}`);
    return result.events;
  }
}

export function rollDraft(overrides: Partial<Extract<EventDraft, { type: "RollAdded" }>["payload"]> = {}): EventDraft {
  return {
    type: "RollAdded",
    payload: {
      rollId: "roll_A",
      rollCode: "K7QX",
      unit: "Medic 12",
      batch: "LOT-A",
      size: 10,
      preEncoded: 8,
      adhesiveExpiry: "2027-12-31",
      lowStockAt: 3,
      ...overrides
    }
  };
}
