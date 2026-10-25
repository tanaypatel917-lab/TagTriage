/** Client target stays below the server's 180,000-character limit on the base64 payload. */
export const IMAGE_BASE64_LIMIT = 175_000;
export const MAX_LONG_EDGE = 1600;
export const MIN_LONG_EDGE = 640;
export const QUALITIES = [0.82, 0.72, 0.62, 0.52, 0.45];
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png"];

export class ImageTooLargeError extends Error {
  constructor() {
    super("This image is too detailed to shrink under 180 KB. Crop it, or paste the record as text.");
    this.name = "ImageTooLargeError";
  }
}

export function base64Length(dataUrl: string): number {
  return dataUrl.length - dataUrl.indexOf(",") - 1;
}

export interface FitResult {
  dataUrl: string;
  longEdge: number;
  quality: number;
}

/** Tries decreasing JPEG quality, then shrinks the long edge by 20% per round until it fits or hits the floor. */
export async function fitUnderLimit(
  encode: (longEdge: number, quality: number) => Promise<string>,
  naturalLongEdge: number,
  limit = IMAGE_BASE64_LIMIT
): Promise<FitResult> {
  const floor = Math.min(MIN_LONG_EDGE, naturalLongEdge);
  const edges: number[] = [];
  for (let edge = Math.min(MAX_LONG_EDGE, naturalLongEdge); edge > floor; edge = Math.floor(edge * 0.8)) edges.push(edge);
  edges.push(floor);
  for (const longEdge of edges) {
    for (const quality of QUALITIES) {
      const dataUrl = await encode(longEdge, quality);
      if (base64Length(dataUrl) <= limit) return { dataUrl, longEdge, quality };
    }
  }
  throw new ImageTooLargeError();
}

export interface PreparedImage {
  dataUrl: string;
  bytes: number;
  originalBytes: number;
  width: number;
  height: number;
  recompressed: boolean;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

/** Browser only: returns a JPEG/PNG data URL that fits the NIM inline image limit. */
export async function prepareDocumentImage(file: File): Promise<PreparedImage> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error("Use a JPEG or PNG photo or scan.");
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const original = await readAsDataUrl(file);
  if (base64Length(original) <= IMAGE_BASE64_LIMIT) {
    bitmap.close();
    return { dataUrl: original, bytes: Math.round((base64Length(original) * 3) / 4), originalBytes: file.size, width, height, recompressed: false };
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot resize images.");
  const naturalLongEdge = Math.max(width, height);
  let outWidth = width;
  let outHeight = height;
  const result = await fitUnderLimit(async (longEdge, quality) => {
    const scale = longEdge / naturalLongEdge;
    outWidth = Math.round(width * scale);
    outHeight = Math.round(height * scale);
    canvas.width = outWidth;
    canvas.height = outHeight;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, outWidth, outHeight);
    context.drawImage(bitmap, 0, 0, outWidth, outHeight);
    return canvas.toDataURL("image/jpeg", quality);
  }, naturalLongEdge);
  bitmap.close();
  return {
    dataUrl: result.dataUrl,
    bytes: Math.round((base64Length(result.dataUrl) * 3) / 4),
    originalBytes: file.size,
    width: outWidth,
    height: outHeight,
    recompressed: true
  };
}
