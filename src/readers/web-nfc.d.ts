// Minimal Web NFC typings (https://w3c.github.io/web-nfc/). Not yet part of TypeScript's DOM lib.

interface NDEFRecord {
  readonly recordType: string;
  readonly mediaType?: string;
  readonly id?: string;
  readonly data?: DataView;
  readonly encoding?: string;
  readonly lang?: string;
}

interface NDEFMessage {
  readonly records: ReadonlyArray<NDEFRecord>;
}

interface NDEFRecordInit {
  recordType: string;
  data?: string | BufferSource;
  lang?: string;
  encoding?: string;
}

interface NDEFMessageInit {
  records: NDEFRecordInit[];
}

interface NDEFReadingEvent extends Event {
  readonly serialNumber: string;
  readonly message: NDEFMessage;
}

interface NDEFScanOptions {
  signal?: AbortSignal;
}

interface NDEFWriteOptions {
  overwrite?: boolean;
  signal?: AbortSignal;
}

declare class NDEFReader extends EventTarget {
  constructor();
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
  scan(options?: NDEFScanOptions): Promise<void>;
  write(message: string | NDEFMessageInit, options?: NDEFWriteOptions): Promise<void>;
}
