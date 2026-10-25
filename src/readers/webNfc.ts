import type { TagRead, TagReader, TagRecordText, TagWriteRequest, TagWriteResult } from "./types";

const WRITE_TIMEOUT_MS = 20_000;

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") return "NFC permission was denied.";
  if (error instanceof DOMException && error.name === "NotSupportedError") return "This device cannot use NFC.";
  if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) return "No sticker was tapped in time.";
  return error instanceof Error ? error.message : fallback;
}

export function decodeNdefRecords(message: NDEFMessage): TagRecordText[] {
  return message.records
    .filter((record) => record.recordType === "text" && record.data)
    .map((record) => ({ recordType: "text", text: new TextDecoder(record.encoding ?? "utf-8").decode(record.data) }));
}

/** Android Chrome Web NFC reader. Requires HTTPS and a user gesture to start scanning. */
export class WebNfcReader implements TagReader {
  readonly kind = "web-nfc" as const;
  readonly label = "Phone NFC";

  isSupported(): boolean {
    return typeof window !== "undefined" && "NDEFReader" in window && window.isSecureContext;
  }

  async startScan(onRead: (read: TagRead) => void, onError: (message: string) => void): Promise<() => void> {
    const reader = new NDEFReader();
    const controller = new AbortController();
    reader.onreading = (event) =>
      onRead({ source: "web-nfc", at: new Date().toISOString(), serialNumber: event.serialNumber, records: decodeNdefRecords(event.message) });
    reader.onreadingerror = () => onError("The sticker could not be read. Hold it still against the back of the phone.");
    try {
      await reader.scan({ signal: controller.signal });
    } catch (error) {
      onError(errorMessage(error, "Could not start NFC scanning."));
    }
    return () => controller.abort();
  }

  async write(request: TagWriteRequest): Promise<TagWriteResult> {
    try {
      const reader = new NDEFReader();
      await reader.write(
        { records: request.records.map((record) => ({ recordType: "text", data: record.text, lang: "en" })) },
        { overwrite: true, signal: AbortSignal.timeout(WRITE_TIMEOUT_MS) }
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, error: errorMessage(error, "Writing the sticker failed.") };
    }
  }
}
