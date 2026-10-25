export type StoragePersistence = "persisted" | "best-effort" | "unsupported";

type PersistApi = Pick<StorageManager, "persisted" | "persist">;

export async function ensurePersistentStorage(
  storage: PersistApi | undefined = typeof navigator === "undefined" ? undefined : navigator.storage
): Promise<StoragePersistence> {
  if (!storage || typeof storage.persisted !== "function" || typeof storage.persist !== "function") {
    return "unsupported";
  }

  try {
    if (await storage.persisted()) return "persisted";
    return (await storage.persist()) ? "persisted" : "best-effort";
  } catch {
    return "best-effort";
  }
}
