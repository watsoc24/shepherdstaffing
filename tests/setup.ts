// Test env. Uses TEST_DATABASE_URL so the dev database is never touched.
Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://shepherd:shepherd@localhost:5432/shepherd_app_test",
  JWT_SECRET: "t".repeat(64),
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  CRON_SECRET: "c".repeat(32),
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  ADMIN_EMAILS: "boss@shepherdstaffing.com",
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
});
