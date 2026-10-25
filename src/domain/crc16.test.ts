import { describe, expect, it } from "vitest";
import { crc16, crc16Hex } from "./crc16";

describe("crc16 (CCITT-FALSE)", () => {
  it("matches the standard check value", () => {
    expect(crc16("123456789")).toBe(0x29b1);
  });

  it("formats as four uppercase hex digits", () => {
    expect(crc16Hex("123456789")).toBe("29B1");
    expect(crc16Hex("")).toBe("FFFF");
  });
});
