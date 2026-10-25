import { describe, expect, it, vi } from "vitest";
import { SAMPLE_PATIENT, SAMPLE_RECORD } from "@/domain/samples";
import { nimRewrite } from "./nim";
import { ImageNeedsNimError } from "./types";

const now = () => new Date("2026-09-26T12:00:00Z");
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

describe("nimRewrite", () => {
  it("builds a NIM summary from the route response", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      json({ extracted: { allergies: ["Sulfa"], medications: ["Eliquis"], conditions: [], anticoagulants: true, dnr: true }, model: "openai/gpt-oss-120b" })
    );
    const summary = await nimRewrite(SAMPLE_RECORD, SAMPLE_PATIENT, undefined, { fetchImpl, now, online: () => true });
    expect(summary.rewriter).toEqual({ id: "nim", model: "openai/gpt-oss-120b", visionModel: undefined });
    expect(summary.facts.allergies).toContain("Sulfa");
    expect(summary.facts.dnr).toBe(false);
    expect(summary.pendingConfirmations).toEqual(["dnr"]);
  });

  it("falls back to the local extractor when NIM is unconfigured", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ error: "nim_unconfigured", message: "NVIDIA NIM is not configured on this server" }, 503));
    const summary = await nimRewrite(SAMPLE_RECORD, SAMPLE_PATIENT, undefined, { fetchImpl, now, online: () => true });
    expect(summary.rewriter.id).toBe("local");
    expect(summary.rewriter.fallbackReason).toContain("not configured");
    expect(summary.facts.medications).toContain("Eliquis 5 mg twice daily");
  });

  it("skips the network entirely when offline", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const summary = await nimRewrite(SAMPLE_RECORD, SAMPLE_PATIENT, undefined, { fetchImpl, now, online: () => false });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(summary.rewriter).toMatchObject({ id: "local", fallbackReason: "Offline" });
  });

  it("raises ImageNeedsNimError for image-only records when NIM fails", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("network"));
    await expect(nimRewrite("", SAMPLE_PATIENT, "data:image/png;base64,AAAA", { fetchImpl, now, online: () => true })).rejects.toBeInstanceOf(ImageNeedsNimError);
    await expect(nimRewrite("  ", SAMPLE_PATIENT, "data:image/png;base64,AAAA", { fetchImpl, now, online: () => false })).rejects.toBeInstanceOf(ImageNeedsNimError);
  });

  it("summarizes manual facts alone when there is no record", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const summary = await nimRewrite("", SAMPLE_PATIENT, undefined, { fetchImpl, now, online: () => true });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(summary.headline).toContain("Margaret Chen");
  });
});
