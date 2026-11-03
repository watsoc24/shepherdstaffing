import { z } from "zod";

/**
 * Server-only environment. Parsed once on first use and at server boot
 * (src/instrumentation.ts), so a missing secret fails fast with a clear list.
 * Never import this from client components.
 */

const key32 = z
  .string()
  .refine((v) => Buffer.from(v, "base64").length === 32, "must be 32 random bytes, base64 (npm run gen:secrets)");

const optionalKey32 = z.preprocess((v) => (v === "" ? undefined : v), key32.optional());

const base = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  JWT_SECRET: z.string().refine((v) => Buffer.byteLength(v) >= 64, "must be at least 64 bytes (npm run gen:secrets)"),
  ENCRYPTION_KEY: key32,
  ENCRYPTION_KEY_VERSION: z.coerce.number().int().min(1).default(1),
  ENCRYPTION_KEY_PREVIOUS: optionalKey32, // previous key, version = ENCRYPTION_KEY_VERSION - 1
  CRON_SECRET: z.string().min(32),
  ADMIN_EMAILS: z.string().default(""),
  SUPPORT_EMAIL: z.string().default("support@shepherdstaffing.com"),

  // Integrations — required in production, optional in dev/test.
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PLATFORM_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PLATFORM_ANNUAL: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("no-reply@shepherdstaffing.com"),
  EMAIL_FROM_NAME: z.string().default("Shepherd Staffing"),
  BACKGROUND_CHECK_VENDOR: z.string().optional(),
  BACKGROUND_CHECK_API_KEY: z.string().optional(),
});

const PROD_REQUIRED = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PLATFORM_MONTHLY",
  "STRIPE_PRICE_PLATFORM_ANNUAL",
  "BREVO_API_KEY",
] as const;

export type Env = z.infer<typeof base> & { isProd: boolean; adminEmails: string[] };

let cached: Env | undefined;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = base.safeParse(source);
  const problems = result.success ? [] : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  if (result.success && result.data.NODE_ENV === "production") {
    for (const k of PROD_REQUIRED) if (!result.data[k]) problems.push(`${k}: required in production`);
  }
  if (problems.length) {
    throw new Error(`Invalid environment configuration:\n  ${problems.join("\n  ")}\nSee .env.example.`);
  }
  const data = result.data!;
  return {
    ...data,
    isProd: data.NODE_ENV === "production",
    adminEmails: data.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  };
}

export function env(): Env {
  cached ??= parseEnv();
  return cached;
}

/** Test helper: forget the cached parse after changing process.env. */
export function resetEnvCache() {
  cached = undefined;
}
