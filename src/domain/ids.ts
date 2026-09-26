const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function toCrockford(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out;
}

export function newId(prefix: string, bytes: Uint8Array = randomBytes(16)): string {
  return `${prefix}_${toCrockford(bytes)}`;
}

export function newRollCode(bytes: Uint8Array = randomBytes(3)): string {
  return toCrockford(bytes).slice(0, 4);
}

export function tagIdFor(rollCode: string, index: number): string {
  return `${rollCode}${String(index).padStart(3, "0")}`;
}

export function shortId(id: string, length = 4): string {
  const body = id.includes("_") ? id.slice(id.indexOf("_") + 1) : id;
  return body.slice(0, length);
}
