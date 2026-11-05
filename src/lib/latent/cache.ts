// Latent.pk — Shared cache utility (Task 116 Part B4 — hardened)
//
// Production: REDIS_URL env var → real Redis (multi-instance safe).
// Fallback behaviour is EXPLICITLY environment-gated:
//   - NODE_ENV !== "production": in-memory Map fallback allowed (dev/test only)
//   - NODE_ENV === "production":
//       * REDIS_URL missing → DEGRADED mode (no cache). Volatile process memory
//         must never silently stand in for distributed cache/rate-limit state.
//       * REDIS_URL set but connection fails → DEGRADED mode with an
//         operational warning; commands no-op instead of pretending.
//
// Callers that need reliable distributed behaviour (rate limiting,
// idempotency) must consult cacheStatus() and degrade gracefully — e.g.
// fail closed for write endpoints or surface an operational warning.

import Redis from "ioredis";
import RedisMock from "ioredis-mock";

type RedisMockClient = InstanceType<typeof RedisMock>;
let client: Redis | RedisMockClient | null = null;
let useMock = false;
let degraded = false;
let degradedReason: string | null = null;

function markDegraded(reason: string) {
  degraded = true;
  degradedReason = reason;
  console.warn(`[cache] DEGRADED MODE — ${reason}`);
}

function getClient(): Redis | RedisMockClient | null {
  if (client) return client;

  const redisUrl = process.env.REDIS_URL;
  const isProd = process.env.NODE_ENV === "production";
  try {
    if (redisUrl) {
      client = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        enableOfflineQueue: false,
        lazyConnect: false,
        retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
      });
      client.on("error", (err) => {
        // Connection problems in production put the cache into degraded mode:
        // commands no-op rather than silently degrading to volatile memory.
        markDegraded(`Redis connection error: ${err.message}`);
      });
      client.on("ready", () => {
        degraded = false;
        degradedReason = null;
      });
      console.info(`[cache] Connected to Redis at ${redisUrl.replace(/:[^@]+@/, ":***@")}`);
    } else if (isProd) {
      // Production without REDIS_URL: do NOT start a mock. Degraded mode.
      markDegraded("REDIS_URL is not configured in production — cache/rate-limit state is not persistent");
      return null;
    } else {
      // Dev/test only: in-memory mock is acceptable and explicitly labelled.
      client = new RedisMock();
      useMock = true;
      console.info("[cache] Using in-memory cache (dev/test fallback; set REDIS_URL for production Redis)");
    }
  } catch (err) {
    if (isProd) {
      markDegraded(`Failed to init Redis: ${err instanceof Error ? err.message : "unknown"}`);
      client = null;
      return null;
    }
    console.warn("[cache] Failed to init Redis, falling back to in-memory (dev only):", err);
    client = new RedisMock();
    useMock = true;
  }
  return client;
}

export async function cacheGet(key: string): Promise<string | null> {
  try {
    const c = getClient();
    if (!c) return null;
    return await c.get(key);
  } catch (err) {
    console.warn(`[cache] GET ${key} failed:`, err);
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number = 3600): Promise<void> {
  try {
    const c = getClient();
    if (!c) return;
    await c.set(key, value, "EX", ttlSeconds);
  } catch (err) {
    console.warn(`[cache] SET ${key} failed:`, err);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    const c = getClient();
    if (!c) return;
    await c.del(key);
  } catch (err) {
    console.warn(`[cache] DEL ${key} failed:`, err);
  }
}

export async function cacheGetJSON<T>(key: string): Promise<T | null> {
  const raw = await cacheGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJSON<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
  await cacheSet(key, JSON.stringify(value), ttlSeconds);
}

export function isUsingMock(): boolean {
  return useMock;
}

export function isDegraded(): boolean {
  return degraded;
}

export function getCacheStatus(): {
  type: "redis" | "memory" | "degraded";
  ready: boolean;
  warning: string | null;
} {
  if (degraded) return { type: "degraded", ready: false, warning: degradedReason };
  return { type: useMock ? "memory" : "redis", ready: !!client, warning: null };
}
