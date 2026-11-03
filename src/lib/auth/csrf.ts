import type { NextApiRequest } from "next";
import { env } from "../env";
import { forbidden } from "../api/errors";

/**
 * CSRF (spec §10): every state-changing request must come from our own origin,
 * on top of SameSite=Lax cookies. Browsers always send Origin on cross-site
 * POST/PUT/PATCH/DELETE; if it's missing we fall back to Referer, and reject
 * when neither is present. Stripe webhooks opt out (they're signature-verified).
 */
export function allowedOrigins(req: NextApiRequest): Set<string> {
  const set = new Set<string>([new URL(env().NEXT_PUBLIC_APP_URL).origin]);
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ?? "https";
  if (typeof host === "string" && host) set.add(`${proto}://${host}`);
  return set;
}

export function assertSameOrigin(req: NextApiRequest) {
  const origin = req.headers.origin;
  let source: string | undefined = typeof origin === "string" && origin !== "null" ? origin : undefined;
  if (!source && typeof req.headers.referer === "string") {
    try {
      source = new URL(req.headers.referer).origin;
    } catch {
      source = undefined;
    }
  }
  if (!source || !allowedOrigins(req).has(source)) throw forbidden("Cross-site request blocked.", "CSRF");
}
