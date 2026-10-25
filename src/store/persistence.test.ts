import { describe, expect, it, vi } from "vitest";
import { ensurePersistentStorage } from "./persistence";

describe("ensurePersistentStorage", () => {
  it("returns unsupported when storage is undefined", async () => {
    expect(await ensurePersistentStorage(undefined)).toBe("unsupported");
  });

  it("returns unsupported when persist is missing", async () => {
    const storage = { persisted: vi.fn().mockResolvedValue(false) };
    expect(await ensurePersistentStorage(storage as unknown as Parameters<typeof ensurePersistentStorage>[0])).toBe("unsupported");
  });

  it("does not request persistence when already persisted", async () => {
    const storage = {
      persisted: vi.fn().mockResolvedValue(true),
      persist: vi.fn().mockResolvedValue(true)
    };

    expect(await ensurePersistentStorage(storage)).toBe("persisted");
    expect(storage.persist).not.toHaveBeenCalled();
  });

  it("returns persisted when the request is granted", async () => {
    const storage = {
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(true)
    };

    expect(await ensurePersistentStorage(storage)).toBe("persisted");
    expect(storage.persist).toHaveBeenCalledOnce();
  });

  it("returns best-effort when the request is denied", async () => {
    const storage = {
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(false)
    };

    expect(await ensurePersistentStorage(storage)).toBe("best-effort");
  });

  it("returns best-effort when checking persisted storage rejects", async () => {
    const storage = {
      persisted: vi.fn().mockRejectedValue(new Error("storage unavailable")),
      persist: vi.fn().mockResolvedValue(true)
    };

    expect(await ensurePersistentStorage(storage)).toBe("best-effort");
  });
});
