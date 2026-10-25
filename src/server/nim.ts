import { extractFirstJsonObject, normalizeExtraction, type ExtractedFacts } from "@/domain/extraction";

export const NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
export const DEFAULT_TEXT_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_VISION_MODEL = "meta/llama-3.2-90b-vision-instruct";
export const MAX_TEXT_CHARS = 20_000;
export const MAX_IMAGE_BASE64 = 180_000;
export const MAX_BODY_BYTES = 400_000;
const TIMEOUT_MS = 25_000;

export const TRANSCRIBE_PROMPT =
  "Transcribe all text in this medical document image verbatim. Preserve headings, lists and line breaks. " +
  "Do not summarize, interpret or add anything. Write [illegible] for unreadable words. Output only the transcription.";

export const EXTRACTION_PROMPT = `You extract emergency-relevant facts from a patient's medical record for EMS responders.
Return ONLY a JSON object, with no prose and no code fences, with exactly these keys:
{"allergies": string[], "medications": string[], "conditions": string[], "anticoagulants": boolean, "dnr": boolean}
Rules:
- Include only facts explicitly stated in the record. Never guess or infer.
- allergies: substances the patient is allergic to, with a short reaction in parentheses if stated. Use [] if none or NKDA.
- medications: current medications, with dose if given.
- conditions: diagnoses and relevant medical history.
- anticoagulants: true only if a blood thinner (anticoagulant or antiplatelet, e.g. warfarin, apixaban, rivaroxaban, dabigatran, enoxaparin, heparin, clopidogrel, ticagrelor) is listed.
- dnr: true only if the record explicitly states DNR, DNAR, do not resuscitate or no CPR. False for full code or when not mentioned.`;

export interface NimEnv {
  apiKey?: string;
  textModel: string;
  visionModel: string;
}

export function nimEnvFromProcess(): NimEnv {
  return {
    apiKey: process.env.NVIDIA_NIM_API_KEY?.trim() || undefined,
    textModel: process.env.NVIDIA_NIM_MODEL?.trim() || DEFAULT_TEXT_MODEL,
    visionModel: process.env.NVIDIA_NIM_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL
  };
}

export type RewriteErrorCode =
  | "invalid_request"
  | "payload_too_large"
  | "unsupported_image"
  | "forbidden_origin"
  | "rate_limited"
  | "nim_unconfigured"
  | "nim_upstream_error"
  | "nim_bad_output"
  | "nim_timeout";

export interface RewriteSuccess {
  extracted: ExtractedFacts;
  model: string;
  visionModel?: string;
  transcript?: string;
}

export interface RewriteFailure {
  error: RewriteErrorCode;
  message: string;
  upstreamStatus?: number;
}

export type RewriteResponse = RewriteSuccess | RewriteFailure;
export interface HandlerResult {
  status: number;
  body: RewriteResponse;
}

export interface RewriteInput {
  rawBody: string;
  origin?: string | null;
  host?: string | null;
}

type ChatContent = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
type ChatResult = { ok: true; content: string } | { ok: false; failure: HandlerResult };

function fail(status: number, error: RewriteErrorCode, message: string, upstreamStatus?: number): HandlerResult {
  return { status, body: { error, message, ...(upstreamStatus ? { upstreamStatus } : {}) } };
}

function contentOf(json: unknown): string {
  if (typeof json !== "object" || json === null) return "";
  const choices = (json as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  return typeof message?.content === "string" ? message.content : "";
}

async function chat(
  env: NimEnv,
  fetchImpl: typeof fetch,
  model: string,
  messages: { role: "system" | "user"; content: ChatContent }[],
  extra: Record<string, unknown>,
  timeoutMs: number
): Promise<ChatResult> {
  let response: Response;
  try {
    response = await fetchImpl(NIM_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ model, messages, stream: false, ...extra }),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      ok: false,
      failure: timedOut ? fail(504, "nim_timeout", "NVIDIA NIM did not respond in time") : fail(502, "nim_upstream_error", "NVIDIA NIM is unreachable")
    };
  }
  if (!response.ok) {
    return { ok: false, failure: fail(502, "nim_upstream_error", `NVIDIA NIM returned HTTP ${response.status}`, response.status) };
  }
  const json: unknown = await response.json().catch(() => null);
  return { ok: true, content: contentOf(json) };
}

function parseBody(rawBody: string): { documentText: string; documentImage?: string } | HandlerResult {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return fail(400, "invalid_request", "Body must be JSON");
  }
  if (typeof body !== "object" || body === null) return fail(400, "invalid_request", "Body must be a JSON object");
  const { documentText, documentImage } = body as Record<string, unknown>;
  if (documentText !== undefined && typeof documentText !== "string") return fail(400, "invalid_request", "documentText must be a string");
  if (documentImage !== undefined && typeof documentImage !== "string") return fail(400, "invalid_request", "documentImage must be a string");
  const text = (documentText ?? "").trim();
  const image = documentImage?.trim() || undefined;
  if (!text && !image) return fail(400, "invalid_request", "Provide documentText, documentImage, or both");
  if (text.length > MAX_TEXT_CHARS) return fail(413, "payload_too_large", `documentText is limited to ${MAX_TEXT_CHARS} characters`);
  if (image) {
    const match = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(image);
    if (!match) return fail(415, "unsupported_image", "documentImage must be a base64 data:image/png or data:image/jpeg URL");
    if (match[2].length >= MAX_IMAGE_BASE64) return fail(413, "payload_too_large", "documentImage must be under about 180 KB");
  }
  return { documentText: text, documentImage: image };
}

/** Pure request handler behind /api/rewrite. The key is only ever sent upstream, never returned or logged. */
export async function handleRewrite(
  input: RewriteInput,
  env: NimEnv,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = TIMEOUT_MS
): Promise<HandlerResult> {
  if (!input.origin || !input.host) {
    return fail(403, "forbidden_origin", "Requests must come from the TagTriage app");
  }
  let originHost: string | undefined;
  try {
    originHost = new URL(input.origin).host;
  } catch {
    originHost = undefined;
  }
  if (originHost !== input.host) return fail(403, "forbidden_origin", "Cross-origin requests are not allowed");
  if (new TextEncoder().encode(input.rawBody).length > MAX_BODY_BYTES) return fail(413, "payload_too_large", "Request body is too large");
  const parsed = parseBody(input.rawBody);
  if ("status" in parsed) return parsed;
  if (!env.apiKey) return fail(503, "nim_unconfigured", "NVIDIA NIM is not configured on this server");

  let transcript: string | undefined;
  if (parsed.documentImage) {
    const vision = await chat(
      env,
      fetchImpl,
      env.visionModel,
      [{ role: "user", content: [{ type: "text", text: TRANSCRIBE_PROMPT }, { type: "image_url", image_url: { url: parsed.documentImage } }] }],
      { temperature: 0.1, max_tokens: 1500 },
      timeoutMs
    );
    if (!vision.ok) return vision.failure;
    transcript = vision.content.trim();
    if (!transcript) return fail(502, "nim_bad_output", "The vision model returned no transcription");
  }

  const combined = [parsed.documentText, transcript ? `--- Transcribed from uploaded image ---\n${transcript}` : ""].filter(Boolean).join("\n\n");
  const reasoning = env.textModel.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {};
  const extraction = await chat(
    env,
    fetchImpl,
    env.textModel,
    [
      { role: "system", content: EXTRACTION_PROMPT },
      { role: "user", content: combined }
    ],
    { temperature: 0, top_p: 1, max_tokens: 2048, ...reasoning },
    timeoutMs
  );
  if (!extraction.ok) return extraction.failure;
  const extracted = normalizeExtraction(extractFirstJsonObject(extraction.content));
  if (!extracted) return fail(502, "nim_bad_output", "The model did not return the expected JSON");
  return {
    status: 200,
    body: { extracted, model: env.textModel, ...(transcript ? { visionModel: env.visionModel, transcript } : {}) }
  };
}
