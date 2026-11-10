import type { NextApiRequest, NextApiResponse } from "next";
import type { Role, User } from "../../generated/prisma/client";
import { users } from "../db";
import { forbidden, unauthorized } from "../api/errors";
import { getEntitlements, type Capability, type Entitlements } from "../billing/entitlements";
import { cookieName, getCookie, readSession, setSessionCookie, shouldRefresh } from "./session";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface AuthContext {
  user: User;
  entitlements: Entitlements;
}

/**
 * Loads the signed-in user from the DB (not from the cookie), rejects revoked
 * sessions (sessionVersion mismatch), deactivated or deleted users, and slides
 * the 7-day cookie expiry.
 */
export async function getAuth(req: NextApiRequest | IncomingMessage, res?: NextApiResponse | ServerResponse): Promise<AuthContext | null> {
  const claims = await readSession(getCookie(req, cookieName()));
  if (!claims) return null;
  const user = await users.findById(claims.userId);
  if (!user || user.sessionVersion !== claims.sv || user.deactivatedAt || user.deletedAt) return null;
  if (res && shouldRefresh(claims)) await setSessionCookie(res, user.id, user.role, user.sessionVersion);
  return { user, entitlements: await getEntitlements(user.id) };
}

export async function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  opts: { allowUnverified?: boolean } = {},
): Promise<AuthContext> {
  const ctx = await getAuth(req, res);
  if (!ctx) throw unauthorized();
  if (!ctx.user.emailVerified && !opts.allowUnverified) {
    throw forbidden("Please verify your email address first.", "EMAIL_NOT_VERIFIED");
  }
  return ctx;
}

export async function requireRole(req: NextApiRequest, res: NextApiResponse, ...roles: Role[]) {
  const ctx = await requireAuth(req, res);
  if (!roles.includes(ctx.user.role)) throw forbidden();
  return ctx;
}

const UPGRADE_MESSAGES: Partial<Record<Capability, string>> = {
  canContact: "Contacting matches requires a membership.",
  canSeeFullListings: "Full listing details require a membership.",
  canViewInterviewResults: "Viewing interview results requires a membership.",
  canBrowseListings: "Your trial has ended. Choose a membership to keep browsing.",
};

/** Server-side capability gate. UI hiding is cosmetic; this is the real check. */
export function requireEntitlement(ctx: AuthContext, capability: Capability) {
  if (!ctx.entitlements[capability]) {
    throw forbidden(UPGRADE_MESSAGES[capability] ?? "Your plan doesn't include this.", "UPGRADE_REQUIRED");
  }
}
