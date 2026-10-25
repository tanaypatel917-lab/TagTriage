import type { TagRead, TagReader, TagRecordText, TagWriteRequest, TagWriteResult } from "./types";

/**
 * Contract for an external reader (USB/Bluetooth desktop reader, rugged handheld) exposed to the browser through a
 * local bridge such as a WebSocket or WebHID service. No concrete bridge ships with the demonstrator.
 */
export interface ExternalReaderBridge {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  onTag(listener: (read: Omit<TagRead, "source">) => void): () => void;
  write(records: TagRecordText[]): Promise<void>;
}

export function createBridgeReader(bridge: ExternalReaderBridge): TagReader {
  return {
    kind: "bridge",
    label: bridge.name,
    isSupported: () => true,
    async startScan(onRead, onError) {
      try {
        await bridge.connect();
      } catch (error) {
        onError(error instanceof Error ? error.message : "Bridge connection failed.");
      }
      const unsubscribe = bridge.onTag((read) => onRead({ ...read, source: "bridge" }));
      return () => {
        unsubscribe();
        void bridge.disconnect();
      };
    },
    async write(request: TagWriteRequest): Promise<TagWriteResult> {
      try {
        await bridge.write(request.records);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Bridge write failed." };
      }
    }
  };
}
