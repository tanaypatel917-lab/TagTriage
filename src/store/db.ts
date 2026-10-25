import Dexie, { type DBCore, type DBCoreMutateRequest, type Table } from "dexie";
import type { AppEvent } from "@/domain/events";
import type { MetaRow, ProfileRecord } from "./types";

export class AppendOnlyError extends Error {
  constructor(operation: string) {
    super(`The event log is append-only (${operation} is not allowed)`);
    this.name = "AppendOnlyError";
  }
}

function appendOnly(down: DBCore): DBCore {
  return {
    ...down,
    table(name) {
      const table = down.table(name);
      if (name !== "events") return table;
      return {
        ...table,
        mutate(request: DBCoreMutateRequest) {
          return request.type === "add" ? table.mutate(request) : Promise.reject(new AppendOnlyError(request.type));
        }
      };
    }
  };
}

export class TagTriageDB extends Dexie {
  events!: Table<AppEvent, string>;
  profiles!: Table<ProfileRecord, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = "tagtriage") {
    super(name);
    this.version(1).stores({
      events: "id, stream, type, at, [deviceId+seq]",
      profiles: "tagId, updatedAt",
      meta: "key"
    });
    this.use({ stack: "dbcore", name: "append-only-events", create: appendOnly });
  }
}

let instance: TagTriageDB | undefined;

/** Lazily opened browser database. Never call during server rendering. */
export function getDb(): TagTriageDB {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB is not available in this environment");
  return (instance ??= new TagTriageDB());
}
