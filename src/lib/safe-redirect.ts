const BASE = "https://internal.invalid";

/** Only allow same-site relative paths, to prevent open redirects. */
export function safeNext(next: unknown, fallback = "/account"): string {
  if (typeof next !== "string" || next.length > 500) return fallback;
  if (!next.startsWith("/") || /[\x00-\x1f\x7f\\]/.test(next)) return fallback;
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE) return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}
