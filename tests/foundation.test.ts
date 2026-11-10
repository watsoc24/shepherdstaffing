import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";
import { rateLimit, resetMemoryLimits } from "@/lib/security/rateLimit";
import { emailField, profileText, stripControlChars } from "@/lib/security/sanitize";
import { pick } from "@/lib/db/pick";

const good = {
  NODE_ENV: "development",
  DATABASE_URL: "postgres://x",
  JWT_SECRET: "j".repeat(64),
  ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
  CRON_SECRET: "c".repeat(32),
} as NodeJS.ProcessEnv;

describe("env validation", () => {
  it("accepts a minimal dev config", () => {
    expect(parseEnv(good).isProd).toBe(false);
  });
  it("fails fast listing every problem", () => {
    expect(() => parseEnv({ ...good, JWT_SECRET: "short", ENCRYPTION_KEY: "nope" })).toThrow(/JWT_SECRET[\s\S]*ENCRYPTION_KEY/);
  });
  it("requires integration keys in production", () => {
    expect(() => parseEnv({ ...good, NODE_ENV: "production" })).toThrow(/UPSTASH_REDIS_REST_URL: required in production/);
  });
});

describe("rate limiting", () => {
  it("blocks after the limit and reports Retry-After", async () => {
    resetMemoryLimits();
    for (let i = 0; i < 10; i++) expect((await rateLimit("login", "ip:1")).ok).toBe(true);
    const blocked = await rateLimit("login", "ip:1");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect((await rateLimit("login", "ip:2")).ok).toBe(true);
  });
});

describe("sanitization", () => {
  it("strips control characters but keeps newlines", () => {
    expect(stripControlChars("a\u0000b\u0007c\nd\te")).toBe("abc\nd\te");
  });
  it("normalizes email and enforces length caps", () => {
    expect(emailField.parse("  Pastor@Church.ORG ")).toBe("pastor@church.org");
    expect(profileText.safeParse("x".repeat(5001)).success).toBe(false);
  });
  it("pick() only copies allow-listed keys", () => {
    const body = { name: "ok", role: "admin", verified: true } as Record<string, unknown>;
    expect(pick(body, ["name"] as const)).toEqual({ name: "ok" });
  });
});
