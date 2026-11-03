/**
 * Structured JSON logs. Never pass PII, prompt text, tokens or secrets.
 * Keys that look sensitive are redacted defensively anyway.
 */
const SENSITIVE = /pass|token|secret|key|authorization|cookie|email|ssn|answer|prompt|body|content/i;

function redact(meta: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, SENSITIVE.test(k) ? "[redacted]" : v]));
}

function write(level: "info" | "warn" | "error", event: string, meta: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...redact(meta) });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.info)(line);
}

export const log = {
  info: (event: string, meta?: Record<string, unknown>) => write("info", event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => write("warn", event, meta),
  error: (event: string, meta?: Record<string, unknown>) => write("error", event, meta),
};
