import type { NextApiRequest, NextApiResponse } from "next";
import type { IncomingMessage, ServerResponse } from "node:http";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../env";
import type { Role } from "../../generated/prisma/client";

/**
 * Session cookie: HS256-signed JWT carrying ONLY userId, role and
 * sessionVersion (defect #3: no entitlements in the token). 7-day sliding
 * expiry; bumping User.sessionVersion revokes every outstanding cookie.
 */
export const SESSION_DAYS = 7;
const REFRESH_AFTER_MS = 24 * 3600_000; // re-issue at most daily to slide the window

export const cookieName = () => (env().isProd ? "__Host-ss_session" : "ss_session");
const secret = () => new TextEncoder().encode(env().JWT_SECRET);

export interface SessionClaims {
  userId: string;
  role: Role;
  sv: number;
  iat: number;
}

export async function signSession(userId: string, role: Role, sessionVersion: number) {
  return new SignJWT({ role, sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function readSession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.sv !== "number" || typeof payload.role !== "string") return null;
    return { userId: payload.sub, role: payload.role as Role, sv: payload.sv, iat: (payload.iat ?? 0) * 1000 };
  } catch {
    return null;
  }
}

type Res = NextApiResponse | ServerResponse;

function appendCookie(res: Res, cookie: string) {
  const prev = res.getHeader("Set-Cookie");
  const list = Array.isArray(prev) ? prev.map(String) : prev ? [String(prev)] : [];
  res.setHeader("Set-Cookie", [...list.filter((c) => !c.startsWith(`${cookieName()}=`)), cookie]);
}

export async function setSessionCookie(res: Res, userId: string, role: Role, sessionVersion: number) {
  const token = await signSession(userId, role, sessionVersion);
  const attrs = [
    `${cookieName()}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_DAYS * 86400}`,
    ...(env().isProd ? ["Secure"] : []),
  ];
  appendCookie(res, attrs.join("; "));
}

export function clearSessionCookie(res: Res) {
  appendCookie(res, [`${cookieName()}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0", ...(env().isProd ? ["Secure"] : [])].join("; "));
}

export function getCookie(req: NextApiRequest | IncomingMessage, name: string): string | undefined {
  const fromParsed = (req as NextApiRequest).cookies?.[name];
  if (fromParsed) return fromParsed;
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export const shouldRefresh = (claims: SessionClaims) => Date.now() - claims.iat > REFRESH_AFTER_MS;
