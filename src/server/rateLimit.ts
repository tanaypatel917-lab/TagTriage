export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export interface RateLimiter {
  peek(key: string): RateLimitResult;
  record(key: string): void;
  check(key: string): RateLimitResult;
  size(): number;
}

export function createRateLimiter(opts: { limit: number; windowMs: number; now?: () => number }): RateLimiter {
  const now = opts.now ?? Date.now;
  const timestampsByKey = new Map<string, number[]>();
  const sweepIntervalMs = Math.min(opts.windowMs, 60_000);
  let lastSweepAt = Number.NEGATIVE_INFINITY;

  function pruneKeyAt(key: string, currentTime: number): number[] {
    const timestamps = timestampsByKey.get(key);
    if (!timestamps) return [];
    const activeTimestamps = timestamps.filter((timestamp) => currentTime - timestamp <= opts.windowMs);
    if (activeTimestamps.length === 0) timestampsByKey.delete(key);
    else if (activeTimestamps.length !== timestamps.length) timestampsByKey.set(key, activeTimestamps);
    return activeTimestamps;
  }

  function peekAt(key: string, currentTime: number): RateLimitResult {
    const activeTimestamps = pruneKeyAt(key, currentTime);
    if (activeTimestamps.length >= opts.limit) {
      const oldest = activeTimestamps[0];
      const retryAfterSec = Math.max(1, Math.ceil((oldest + opts.windowMs - currentTime) / 1000));
      return { ok: false, retryAfterSec };
    }

    return { ok: true };
  }

  function recordAt(key: string, currentTime: number) {
    if (currentTime - lastSweepAt >= sweepIntervalMs) {
      lastSweepAt = currentTime;
      for (const storedKey of timestampsByKey.keys()) pruneKeyAt(storedKey, currentTime);
    }
    const timestamps = timestampsByKey.get(key) ?? [];
    timestamps.push(currentTime);
    timestampsByKey.set(key, timestamps);
  }

  return {
    peek(key) {
      return peekAt(key, now());
    },
    record(key) {
      recordAt(key, now());
    },
    check(key) {
      const currentTime = now();
      const result = peekAt(key, currentTime);
      if (result.ok) recordAt(key, currentTime);
      return result;
    },
    size() {
      return timestampsByKey.size;
    }
  };
}

export function consumeAll(entries: ReadonlyArray<readonly [RateLimiter, string]>): RateLimitResult {
  const results = entries.map(([limiter, key]) => limiter.peek(key));
  const failures = results.filter((result): result is Extract<RateLimitResult, { ok: false }> => !result.ok);
  if (failures.length > 0) {
    return { ok: false, retryAfterSec: Math.max(...failures.map((failure) => failure.retryAfterSec)) };
  }
  for (const [limiter, key] of entries) limiter.record(key);
  return { ok: true };
}

export function clientKeyOf(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) return forwardedFor;
  const realIp = headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}

export interface RewriteRateLimits {
  perClientPerHour: number;
  globalPerDay: number;
}

function positiveIntegerOr(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

export function rateLimitsFromProcess(): RewriteRateLimits {
  return {
    perClientPerHour: positiveIntegerOr(process.env.REWRITE_RATE_LIMIT_PER_HOUR, 30),
    globalPerDay: positiveIntegerOr(process.env.REWRITE_GLOBAL_LIMIT_PER_DAY, 500)
  };
}
