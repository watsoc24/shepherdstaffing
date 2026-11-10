import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "./redis";

/**
 * Sliding-window rate limits (spec §10), backed by Upstash Redis so they hold
 * across serverless instances. Apply per IP and, when signed in, per user.
 */
export const LIMITS = {
  login: { limit: 10, window: "15 m" },
  signup: { limit: 5, window: "1 h" },
  forgotPassword: { limit: 5, window: "1 h" },
  verify: { limit: 10, window: "1 h" },
  chat: { limit: 60, window: "1 h" }, // paid fair-use; trial has its own lifetime cap
  interviewSubmit: { limit: 5, window: "1 h" },
  messaging: { limit: 30, window: "1 h" },
  inquiry: { limit: 5, window: "1 h" },
  mfa: { limit: 10, window: "15 m" },
  api: { limit: 300, window: "1 m" },
} as const;

export type LimitName = keyof typeof LIMITS;
type Window = `${number} ${"s" | "m" | "h" | "d"}`;

const toMs = (w: Window) => {
  const [n, unit] = w.split(" ") as [string, "s" | "m" | "h" | "d"];
  return Number(n) * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[unit];
};

// In-memory sliding window used only when Redis isn't configured (tests/dev).
const memory = new Map<string, number[]>();
export const resetMemoryLimits = () => memory.clear();

function memoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (memory.get(key) ?? []).filter((t) => t > now - windowMs);
  if (hits.length >= limit) {
    memory.set(key, hits);
    return { ok: false, retryAfter: Math.ceil((hits[0] + windowMs - now) / 1000) };
  }
  hits.push(now);
  memory.set(key, hits);
  return { ok: true, retryAfter: 0 };
}

const limiters = new Map<LimitName, Ratelimit>();

export async function rateLimit(name: LimitName, identifier: string): Promise<{ ok: boolean; retryAfter: number }> {
  const { limit, window } = LIMITS[name];
  const redis = getRedis();
  if (!redis) return memoryLimit(`${name}:${identifier}`, limit, toMs(window as Window));

  let rl = limiters.get(name);
  if (!rl) {
    rl = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(limit, window as Window), prefix: `rl:${name}` });
    limiters.set(name, rl);
  }
  const res = await rl.limit(identifier);
  return { ok: res.success, retryAfter: res.success ? 0 : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)) };
}
