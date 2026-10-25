import { describe, expect, it, vi } from "vitest";
import { ImageTooLargeError, base64Length, fitUnderLimit } from "./image";

/** Fake encoder whose output size scales with area and quality. */
function fakeEncoder(bytesPerPixel: number) {
  return vi.fn(async (longEdge: number, quality: number) => `data:image/jpeg;base64,${"A".repeat(Math.round(longEdge * longEdge * 0.75 * bytesPerPixel * quality))}`);
}

describe("fitUnderLimit", () => {
  it("returns the first quality that fits at full size", async () => {
    const encode = fakeEncoder(0.1);
    const result = await fitUnderLimit(encode, 1200, 60_000);
    expect(result.longEdge).toBe(1200);
    expect(base64Length(result.dataUrl)).toBeLessThanOrEqual(60_000);
    expect(encode.mock.calls[0]).toEqual([1200, 0.82]);
  });

  it("caps the long edge and shrinks by 20% steps", async () => {
    const encode = fakeEncoder(0.2);
    const result = await fitUnderLimit(encode, 4000, 100_000);
    expect(encode.mock.calls[0][0]).toBe(1600);
    expect(result.longEdge).toBeLessThan(1600);
    expect(base64Length(result.dataUrl)).toBeLessThanOrEqual(100_000);
  });

  it("gives up at the floor", async () => {
    await expect(fitUnderLimit(fakeEncoder(10), 3000, 1000)).rejects.toBeInstanceOf(ImageTooLargeError);
  });
});
