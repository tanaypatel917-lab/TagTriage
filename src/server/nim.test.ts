import { describe, expect, it, vi } from "vitest";
import { SAMPLE_RECORD } from "@/domain/samples";
import { EXTRACTION_PROMPT, NIM_URL, handleRewrite, type NimEnv } from "./nim";

const env: NimEnv = { apiKey: "nvapi-test-secret", textModel: "openai/gpt-oss-120b", visionModel: "meta/llama-3.2-90b-vision-instruct" };
const PNG = "data:image/png;base64,iVBORw0KGgo=";

function reply(content: string | null, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status, headers: { "Content-Type": "application/json" } });
}

function body(value: unknown) {
  return { rawBody: JSON.stringify(value), origin: "http://localhost:3000", host: "localhost:3000" };
}

describe("handleRewrite validation", () => {
  it("rejects bad JSON, empty input and wrong types", async () => {
    expect((await handleRewrite({ ...body({}), rawBody: "{" }, env)).status).toBe(400);
    expect((await handleRewrite(body({}), env)).status).toBe(400);
    expect((await handleRewrite(body({ documentText: 42 }), env)).status).toBe(400);
  });

  it("enforces image type and size limits", async () => {
    expect((await handleRewrite(body({ documentImage: "data:image/gif;base64,AAAA" }), env)).status).toBe(415);
    expect((await handleRewrite(body({ documentImage: `data:image/jpeg;base64,${"A".repeat(180_000)}` }), env)).status).toBe(413);
    expect((await handleRewrite(body({ documentText: "x".repeat(20_001) }), env)).status).toBe(413);
  });

  it("rejects requests with no origin before calling upstream", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await handleRewrite({ rawBody: JSON.stringify({ documentText: "hi" }), host: "localhost:3000" }, env, fetchImpl);

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ error: "forbidden_origin", message: "Requests must come from the TagTriage app" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects requests with no host before calling upstream", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await handleRewrite({ rawBody: JSON.stringify({ documentText: "hi" }), origin: "http://localhost:3000" }, env, fetchImpl);

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ error: "forbidden_origin", message: "Requests must come from the TagTriage app" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects mismatched origins before calling upstream", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await handleRewrite({ ...body({ documentText: "hi" }), origin: "https://evil.example" }, env, fetchImpl);

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({ error: "forbidden_origin", message: "Cross-origin requests are not allowed" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns 503 without a key and never calls upstream", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await handleRewrite(body({ documentText: "hi" }), { ...env, apiKey: undefined }, fetchImpl);
    expect(result).toMatchObject({ status: 503, body: { error: "nim_unconfigured" } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("handleRewrite upstream flow", () => {
  it("extracts from text with a strict prompt and low reasoning effort for gpt-oss", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      reply('Sure.\n```json\n{"allergies":["Penicillin"],"medications":["Eliquis"],"conditions":["AFib"],"anticoagulants":true,"dnr":true}\n```')
    );
    const result = await handleRewrite({ ...body({ documentText: SAMPLE_RECORD }), origin: "http://localhost:3000", host: "localhost:3000" }, env, fetchImpl);
    expect(result).toMatchObject({ status: 200, body: { model: env.textModel, extracted: { allergies: ["Penicillin"], anticoagulants: true, dnr: true } } });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(NIM_URL);
    const sent = JSON.parse(String(init?.body));
    expect(sent).toMatchObject({ model: "openai/gpt-oss-120b", reasoning_effort: "low", temperature: 0 });
    expect(sent.messages[0]).toEqual({ role: "system", content: EXTRACTION_PROMPT });
    expect(JSON.stringify(result.body)).not.toContain("nvapi-test-secret");
  });

  it("omits reasoning_effort for other models", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(reply('{"allergies":[],"medications":[],"conditions":[],"anticoagulants":false,"dnr":false}'));
    await handleRewrite(body({ documentText: "hi" }), { ...env, textModel: "meta/llama-4-maverick" }, fetchImpl);
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).not.toHaveProperty("reasoning_effort");
  });

  it("transcribes an image with the vision model and merges it with pasted text", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(reply("Allergies: Latex"))
      .mockResolvedValueOnce(reply('{"allergies":["Latex"],"medications":[],"conditions":[],"anticoagulants":false,"dnr":false}'));
    const result = await handleRewrite(body({ documentText: "Meds: none", documentImage: PNG }), env, fetchImpl);
    expect(result).toMatchObject({ status: 200, body: { visionModel: env.visionModel, transcript: "Allergies: Latex" } });
    const vision = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(vision.model).toBe(env.visionModel);
    expect(vision.messages[0].content[1]).toEqual({ type: "image_url", image_url: { url: PNG } });
    const extraction = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body));
    expect(extraction.messages[1].content).toContain("Meds: none");
    expect(extraction.messages[1].content).toContain("Allergies: Latex");
  });

  it("maps upstream errors, empty output and timeouts", async () => {
    expect(await handleRewrite(body({ documentText: "hi" }), env, vi.fn<typeof fetch>().mockResolvedValue(reply(null, 429)))).toMatchObject({
      status: 502,
      body: { error: "nim_upstream_error", upstreamStatus: 429 }
    });
    expect((await handleRewrite(body({ documentText: "hi" }), env, vi.fn<typeof fetch>().mockResolvedValue(reply(null)))).body).toMatchObject({ error: "nim_bad_output" });
    const timeout = vi.fn<typeof fetch>().mockRejectedValue(Object.assign(new Error("t"), { name: "TimeoutError" }));
    expect((await handleRewrite(body({ documentText: "hi" }), env, timeout)).status).toBe(504);
  });
});
