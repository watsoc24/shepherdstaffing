import type { NextApiRequest, NextApiResponse } from "next";
import { ZodError, type z } from "zod";
import { HttpError, badRequest, tooMany } from "./errors";
import { assertSameOrigin } from "../auth/csrf";
import { rateLimit, type LimitName } from "../security/rateLimit";
import { log } from "../log";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Handler = (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> | unknown;

/**
 * Wraps an API route: method allow-list, same-origin CSRF check on every
 * state-changing method, uniform JSON errors, and no internals leaked.
 */
export function api(handlers: Partial<Record<Method, Handler>>, opts: { csrf?: boolean } = {}) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const method = (req.method ?? "GET") as Method;
    const fn = handlers[method];
    try {
      if (!fn) {
        res.setHeader("Allow", Object.keys(handlers).join(", "));
        throw new HttpError(405, "Method not allowed", "METHOD_NOT_ALLOWED");
      }
      if (method !== "GET" && opts.csrf !== false) assertSameOrigin(req);
      await fn(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        for (const [k, v] of Object.entries(err.headers ?? {})) res.setHeader(k, v);
        return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
      }
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: {
            code: "BAD_REQUEST",
            message: "Please check the highlighted fields.",
            details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          },
        });
      }
      log.error("api.unhandled", { route: req.url?.split("?")[0], method, err: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } });
    }
  };
}

export function parseBody<T extends z.ZodType>(req: NextApiRequest, schema: T): z.infer<T> {
  const r = schema.safeParse(req.body ?? {});
  if (!r.success) {
    throw badRequest(
      "Please check the highlighted fields.",
      r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return r.data;
}

export function parseQuery<T extends z.ZodType>(req: NextApiRequest, schema: T): z.infer<T> {
  return parseBody({ body: req.query } as NextApiRequest, schema);
}

/**
 * Client IP. Behind Cloudflare set CLIENT_IP_HEADER=cf-connecting-ip; on plain
 * Vercel the default x-real-ip is set by Vercel's edge and can't be spoofed.
 */
export function clientIp(req: NextApiRequest): string {
  const header = (process.env.CLIENT_IP_HEADER || "x-real-ip").toLowerCase();
  const v = req.headers[header];
  const first = (Array.isArray(v) ? v[0] : v)?.split(",")[0]?.trim();
  return first || req.socket?.remoteAddress || "unknown";
}

/** Apply one or more limits; throws 429 with Retry-After on the first that trips. */
export async function limit(name: LimitName, ...identifiers: (string | null | undefined)[]) {
  for (const id of identifiers) {
    if (!id) continue;
    const r = await rateLimit(name, id);
    if (!r.ok) throw tooMany(r.retryAfter);
  }
}
