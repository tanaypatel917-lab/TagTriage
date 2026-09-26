export type ReaderKind = "simulator" | "web-nfc" | "bridge";

export interface TagRecordText {
  recordType: "text";
  text: string;
}

export interface TagRead {
  source: ReaderKind;
  at: string;
  serialNumber?: string;
  records: TagRecordText[];
  /** Simulator only: which virtual sticker was tapped (needed to address blank stickers). */
  simulatedTagId?: string;
}

export interface TagWriteRequest {
  records: TagRecordText[];
  simulatedTagId?: string;
}

export type TagWriteResult = { ok: true } | { ok: false; error: string };

export interface TagReader {
  readonly kind: ReaderKind;
  readonly label: string;
  isSupported(): boolean;
  /** Starts listening for taps; resolves to a stop function. */
  startScan(onRead: (read: TagRead) => void, onError: (message: string) => void): Promise<() => void>;
  /** Writes an NDEF message to the next tapped (or addressed) sticker. */
  write(request: TagWriteRequest): Promise<TagWriteResult>;
}

export function textRecords(texts: readonly string[]): TagRecordText[] {
  return texts.map((text) => ({ recordType: "text", text }));
}
