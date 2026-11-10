import { execSync } from "node:child_process";

// Applies migrations to the test database (non-destructive; tests truncate tables themselves).
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://shepherd:shepherd@localhost:5432/shepherd_app_test";
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, stdio: "ignore" });
}
