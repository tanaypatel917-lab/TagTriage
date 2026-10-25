/** NTAG215 user memory (pages 4-129). */
export const NTAG215_CAPACITY = 504;

const LANGUAGE = "en";
const encoder = new TextEncoder();

export function utf8Length(text: string): number {
  return encoder.encode(text).length;
}

/**
 * Well-known text record: header + type length + payload length (1 byte when short, 4 otherwise)
 * + type "T" + payload (status byte + language code + UTF-8 text).
 */
export function textRecordBytes(text: string): number {
  const payload = 1 + LANGUAGE.length + utf8Length(text);
  return 1 + 1 + (payload <= 255 ? 1 : 4) + 1 + payload;
}

/** NDEF message TLV (0x03 + 1 or 3 length bytes) plus the terminator TLV (0xFE). */
export function ndefMessageBytes(texts: string[]): number {
  const message = texts.reduce((sum, text) => sum + textRecordBytes(text), 0);
  return 1 + (message < 255 ? 1 : 3) + message + 1;
}
