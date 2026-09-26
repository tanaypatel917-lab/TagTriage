import { NTAG215_CAPACITY, ndefMessageBytes } from "@/domain/ndef";
import { textRecords, type TagRead, type TagReader, type TagWriteRequest, type TagWriteResult } from "./types";

export type MemorySource = (tagId: string) => string[];

/** Zero-hardware reader. Virtual chip memory is derived from the event log via a memory source. */
export class SimulatorReader implements TagReader {
  readonly kind = "simulator" as const;
  readonly label = "Simulator";
  private readonly listeners = new Set<(read: TagRead) => void>();
  private failNextWrite = false;

  constructor(private memory: MemorySource = () => []) {}

  setMemorySource(memory: MemorySource): void {
    this.memory = memory;
  }

  setFailNextWrite(fail: boolean): void {
    this.failNextWrite = fail;
  }

  get willFailNextWrite(): boolean {
    return this.failNextWrite;
  }

  isSupported(): boolean {
    return true;
  }

  async startScan(onRead: (read: TagRead) => void): Promise<() => void> {
    this.listeners.add(onRead);
    return () => {
      this.listeners.delete(onRead);
    };
  }

  tap(tagId: string): TagRead {
    const read: TagRead = {
      source: "simulator",
      at: new Date().toISOString(),
      records: textRecords(this.memory(tagId)),
      simulatedTagId: tagId
    };
    this.listeners.forEach((listener) => listener(read));
    return read;
  }

  async write(request: TagWriteRequest): Promise<TagWriteResult> {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      return { ok: false, error: "Simulated write failure: the sticker moved away before the write finished." };
    }
    const bytes = ndefMessageBytes(request.records.map((record) => record.text));
    if (bytes > NTAG215_CAPACITY) return { ok: false, error: `Message is ${bytes} bytes; the sticker holds ${NTAG215_CAPACITY}.` };
    return { ok: true };
  }
}
