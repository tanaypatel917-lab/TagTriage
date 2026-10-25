import { afterEach, describe, expect, it, vi } from "vitest";
import { clientKeyOf, consumeAll, createRateLimiter, rateLimitsFromProcess } from "./rateLimit";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createRateLimiter", () => {
  it("allows the limit and reports the retry time for the next request", () => {
    let currentTime = 1_000;
    const limiter = createRateLimiter({ limit: 2, windowMs: 5_000, now: () => currentTime });

    expect(limiter.check("client")).toEqual({ ok: true });
    currentTime = 2_000;
    expect(limiter.check("client")).toEqual({ ok: true });
    currentTime = 3_000;
    expect(limiter.check("client")).toEqual({ ok: false, retryAfterSec: 3 });
  });

  it("allows requests again once the window has passed", () => {
    let currentTime = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => currentTime });

    expect(limiter.check("client")).toEqual({ ok: true });
    currentTime = 1_001;
    expect(limiter.check("client")).toEqual({ ok: true });
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => 0 });

    expect(limiter.check("first")).toEqual({ ok: true });
    expect(limiter.check("second")).toEqual({ ok: true });
    expect(limiter.check("first")).toEqual({ ok: false, retryAfterSec: 1 });
  });

  it("peeks without recording", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => 0 });

    expect(limiter.peek("client")).toEqual({ ok: true });
    expect(limiter.size()).toBe(0);
  });

  it("sweeps expired keys on a later record", () => {
    let currentTime = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000, now: () => currentTime });

    limiter.record("expired");
    expect(limiter.size()).toBe(1);
    currentTime = 2_000;
    limiter.record("new");

    expect(limiter.size()).toBe(1);
  });
});

describe("consumeAll", () => {
  it("does not record the client when the global limiter is full", () => {
    const client = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => 0 });
    const global = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => 0 });
    global.check("global");

    expect(consumeAll([[client, "client"], [global, "global"]])).toEqual({ ok: false, retryAfterSec: 1 });
    expect(client.size()).toBe(0);
  });

  it("does not record the global limiter when the client limiter is full", () => {
    const client = createRateLimiter({ limit: 2, windowMs: 1_000, now: () => 0 });
    const global = createRateLimiter({ limit: 5, windowMs: 1_000, now: () => 0 });
    client.check("client");
    client.check("client");

    expect(consumeAll([[client, "client"], [global, "global"]])).toEqual({ ok: false, retryAfterSec: 1 });
    expect(global.peek("global")).toEqual({ ok: true });
    expect(global.size()).toBe(0);
  });

  it("returns the maximum retry time across refusing limiters", () => {
    let clientTime = 9_000;
    let globalTime = 0;
    const client = createRateLimiter({ limit: 1, windowMs: 9_000, now: () => clientTime });
    const global = createRateLimiter({ limit: 1, windowMs: 15_000, now: () => globalTime });
    client.record("client");
    global.record("global");
    clientTime = 10_000;
    globalTime = 10_000;

    expect(consumeAll([[client, "client"], [global, "global"]])).toEqual({ ok: false, retryAfterSec: 8 });
  });
});

describe("clientKeyOf", () => {
  it("uses the first trimmed forwarded address", () => {
    expect(clientKeyOf(new Headers({ "x-forwarded-for": " 203.0.113.1, 10.0.0.1" }))).toBe("203.0.113.1");
  });

  it("falls back to the real IP and then unknown", () => {
    expect(clientKeyOf(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientKeyOf(new Headers())).toBe("unknown");
  });
});

describe("rateLimitsFromProcess", () => {
  it("uses the defaults when the variables are missing", () => {
    vi.stubEnv("REWRITE_RATE_LIMIT_PER_HOUR", undefined);
    vi.stubEnv("REWRITE_GLOBAL_LIMIT_PER_DAY", undefined);

    expect(rateLimitsFromProcess()).toEqual({ perClientPerHour: 30, globalPerDay: 500 });
  });

  it("uses the defaults for non-integer and below-one values", () => {
    vi.stubEnv("REWRITE_RATE_LIMIT_PER_HOUR", "12.5");
    vi.stubEnv("REWRITE_GLOBAL_LIMIT_PER_DAY", "0");

    expect(rateLimitsFromProcess()).toEqual({ perClientPerHour: 30, globalPerDay: 500 });
  });
});
