// Runs once when the Next.js server boots: fail fast on bad configuration.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SKIP_ENV_VALIDATION !== "1") {
    const { env } = await import("./lib/env");
    env();
  }
}
