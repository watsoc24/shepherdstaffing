import { Redis } from "@upstash/redis";
import { env } from "../env";
import { log } from "../log";

/**
 * Small key-value interface over Upstash Redis (shared across serverless
 * instances). An in-memory store is used ONLY in test, or in development when
 * Upstash isn't configured — production refuses to start without Upstash.
 */
export interface Kv {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Atomic increment; sets the TTL when the key is created. */
  incr(key: string, ttlSeconds: number): Promise<number>;
}

class MemoryKv implements Kv {
  private store = new Map<string, { value: unknown; expires: number }>();
  async get<T>(key: string) {
    const hit = this.store.get(key);
    if (!hit || hit.expires < Date.now()) return null;
    return hit.value as T;
  }
  async set(key: string, value: unknown, ttlSeconds: number) {
    this.store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  }
  async del(key: string) {
    this.store.delete(key);
  }
  async incr(key: string, ttlSeconds: number) {
    const cur = (await this.get<number>(key)) ?? 0;
    const hit = this.store.get(key);
    const next = cur + 1;
    this.store.set(key, { value: next, expires: hit && hit.expires > Date.now() ? hit.expires : Date.now() + ttlSeconds * 1000 });
    return next;
  }
  clear() {
    this.store.clear();
  }
}

let redis: Redis | null | undefined;
export const memoryKv = new MemoryKv();

export function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const e = env();
  if (e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({ url: e.UPSTASH_REDIS_REST_URL, token: e.UPSTASH_REDIS_REST_TOKEN });
  } else {
    if (e.NODE_ENV === "development") log.warn("redis.memory_fallback", { note: "rate limits are per-process in dev" });
    redis = null;
  }
  return redis;
}

export function kv(): Kv {
  const r = getRedis();
  if (!r) return memoryKv;
  return {
    get: <T>(key: string) => r.get<T>(key),
    set: async (key, value, ttlSeconds) => {
      await r.set(key, value, { ex: ttlSeconds });
    },
    del: async (key) => {
      await r.del(key);
    },
    incr: async (key, ttlSeconds) => {
      const n = await r.incr(key);
      if (n === 1) await r.expire(key, ttlSeconds);
      return n;
    },
  };
}
