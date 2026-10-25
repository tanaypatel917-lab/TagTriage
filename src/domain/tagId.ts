import { crc16Hex } from "./crc16";

export const TAG_ID_VERSION = 1;

export type TagIdParse =
  | { ok: true; tagId: string }
  | { ok: false; reason: "format" | "version" | "checksum" };

export function encodeTagIdRecord(tagId: string): string {
  const body = `tt:v${TAG_ID_VERSION}:${tagId}`;
  return `${body}:${crc16Hex(body)}`;
}

export function isTagIdRecord(text: string): boolean {
  return /^tt:v\d+:/.test(text.trim());
}

export function parseTagIdRecord(text: string): TagIdParse {
  const trimmed = text.trim();
  const version = /^tt:v(\d+):/.exec(trimmed);
  if (!version) return { ok: false, reason: "format" };
  if (Number(version[1]) !== TAG_ID_VERSION) return { ok: false, reason: "version" };
  const match = /^tt:v1:([0-9A-Z]{4,16}):([0-9A-F]{4})$/.exec(trimmed);
  if (!match) return { ok: false, reason: "format" };
  const [, tagId, crc] = match;
  if (crc16Hex(`tt:v1:${tagId}`) !== crc) return { ok: false, reason: "checksum" };
  return { ok: true, tagId };
}
