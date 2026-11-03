import { createMocks, type RequestMethod } from "node-mocks-http";
import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

/**
 * Calls a Next API route in-process. A Client keeps the session cookie between
 * calls and sends a same-origin Origin header (like a browser) unless told not to.
 */
export class Client {
  cookie = "";
  constructor(public ip = "203.0.113.10") {}

  async call(
    handler: NextApiHandler,
    opts: { method?: RequestMethod; body?: unknown; query?: Record<string, string>; origin?: string | null } = {},
  ) {
    const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
    const headers: Record<string, string> = { host: "localhost:3000", "x-real-ip": this.ip };
    if (opts.origin !== null && method !== "GET") headers.origin = opts.origin ?? "http://localhost:3000";
    if (this.cookie) headers.cookie = this.cookie;
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method, headers, body: opts.body as never, query: opts.query });
    await handler(req, res);
    const set = res.getHeader("Set-Cookie");
    for (const c of Array.isArray(set) ? set : set ? [String(set)] : []) {
      const [pair, ...attrs] = String(c).split(";");
      if (attrs.some((a) => a.trim() === "Max-Age=0")) this.cookie = "";
      else this.cookie = pair;
    }
    const raw = res._getData();
    let json: any = undefined;
    try {
      json = typeof raw === "string" && raw ? JSON.parse(raw) : raw;
    } catch {
      json = raw;
    }
    return { status: res.statusCode, json, headers: res.getHeaders(), setCookie: set };
  }
}
