export interface RateLimiter {
  check(key: string): { ok: true } | { ok: false; retryAfterSec: number };
}

export function createRateLimiter(opts: { limit: number; windowMs: number; now?: () => number }): RateLimiter {
  const now = opts.now ?? Date.now;
  const timestampsByKey = new Map<string, number[]>();

  return {
    check(key) {
      const currentTime = now();
      for (const [storedKey, timestamps] of timestampsByKey) {
        const activeTimestamps = timestamps.filter((timestamp) => currentTime - timestamp <= opts.windowMs);
        if (activeTimestamps.length === 0) timestampsByKey.delete(storedKey);
        else timestampsByKey.set(storedKey, activeTimestamps);
      }
      const activeTimestamps = timestampsByKey.get(key) ?? [];

      if (activeTimestamps.length >= opts.limit) {
        const oldest = activeTimestamps[0];
        const retryAfterSec = Math.max(1, Math.ceil((oldest + opts.windowMs - currentTime) / 1000));
        return { ok: false, retryAfterSec };
      }

      activeTimestamps.push(currentTime);
      timestampsByKey.set(key, activeTimestamps);
      return { ok: true };
    }
  };
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
