import { execSync } from "node:child_process";

// Applies migrations to the test database (non-destructive; tests truncate tables themselves).
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://fitforministry:fitforministry@localhost:5432/fit_for_ministry_test";
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, stdio: "ignore" });
}
