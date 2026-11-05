// Task 117 Part J2 — in-process rate limiter for single-host deployment.
//
// Scope decision (Part F1): abuse protection is a TEMPORARY concern, not
// durable state. A sliding in-memory window is sufficient for this single-host
// beta (one Next.js server process; `next dev`/`next start` are singletons),
// and losing counters on restart only widens the window briefly — it never
// corrupts data. Durable guarantees (worker idempotency, locks, ledgers) stay
// in SQLite — they must NEVER depend on this module.

import crypto from "node:crypto";

type Bucket = Map<string, number[]>;

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [name, bucket] of buckets) {
    for (const [key, hits] of bucket) {
      const alive = hits.filter((t) => now - t < 3_600_000);
      if (alive.length === 0) bucket.delete(key);
      else bucket.set(key, alive);
    }
    if (bucket.size === 0) buckets.delete(name);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
}

/**
 * Sliding-window limiter. `name` groups limits (e.g. "invite_redeem"),
 * `key` is the subject (e.g. hashed ip or session token).
 */
export function rateLimit(name: string, key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  let bucket = buckets.get(name);
  if (!bucket) {
    bucket = new Map();
    buckets.set(name, bucket);
  }
  const hits = (bucket.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const oldest = hits[0];
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
      remaining: 0,
    };
  }
  hits.push(now);
  bucket.set(key, hits);
  return { allowed: true, retryAfterSec: 0, remaining: limit - hits.length };
}

/** Best-effort client identity for rate limiting: hashed, never stored raw. */
export function clientKey(req: { headers: { get(name: string): string | null } }): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || "local";
  // hash so raw addresses never land in logs or exports
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}
