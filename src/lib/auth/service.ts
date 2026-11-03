import type { NextApiResponse } from "next";
import { users, candidates, churches, consents } from "../db";
import { env } from "../env";
import { randomToken, sha256 } from "../security/crypto";
import { kv } from "../security/redis";
import { audit } from "../security/audit";
import { badRequest, forbidden, HttpError, unauthorized } from "../api/errors";
import { burnPasswordCheck, hashPassword, isBreachedPassword, validatePassword, verifyPassword } from "./password";
import { setSessionCookie } from "./session";
import { invalidateEntitlements, trialWindow } from "../billing/entitlements";
import { sendEmail, sendEmailSafe } from "../email/brevo";
import {
  alreadyRegisteredEmail,
  passwordChangedEmail,
  passwordResetEmail,
  verificationEmail,
  welcomeTrialEmail,
} from "../email/templates";
import { PRIVACY_VERSION, TERMS_VERSION } from "../legal";
import type { User } from "../../generated/prisma/client";

export const VERIFY_TOKEN_HOURS = 24;
export const RESET_TOKEN_MINUTES = 60;
export const MAX_FAILED_LOGINS = 8;
export const LOCKOUT_MINUTES = 15;

async function assertGoodPassword(password: string, email: string) {
  const problem = validatePassword(password, email);
  if (problem) throw badRequest(problem, [{ path: "password", message: problem }]);
  if (await isBreachedPassword(password)) {
    const msg = "This password has appeared in a known data breach. Please choose a different one.";
    throw badRequest(msg, [{ path: "password", message: msg }]);
  }
}

function newVerifyToken() {
  const token = randomToken();
  return { token, hash: sha256(token), expires: new Date(Date.now() + VERIFY_TOKEN_HOURS * 3600_000) };
}

// ───────────────────────────── Signup ─────────────────────────────

export async function signup(input: {
  email: string;
  password: string;
  name: string;
  role: "candidate" | "church";
  ip: string;
}) {
  await assertGoodPassword(input.password, input.email);
  const existing = await users.findByEmail(input.email);
  if (existing) {
    // Same response as a new signup so the form can't be used to discover accounts.
    if (!existing.deletedAt) await sendEmailSafe(alreadyRegisteredEmail(existing.email, existing.name));
    return;
  }
  const v = newVerifyToken(); // defect #1: the token hash IS stored, with a 24h expiry
  let user: User;
  try {
    user = await users.create({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      name: input.name,
      role: input.role,
      verifyTokenHash: v.hash,
      verifyTokenExpires: v.expires,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return; // raced with another signup
    throw e;
  }
  if (input.role === "candidate") await candidates.createForUser(user.id, input.name);
  else await churches.createForUser(user.id, input.name);
  await consents.record(user.id, "terms", TERMS_VERSION, input.ip);
  await consents.record(user.id, "privacy", PRIVACY_VERSION, input.ip);
  await audit("auth.signup", { actorUserId: user.id, targetType: "User", targetId: user.id, ip: input.ip, meta: { role: input.role } });
  await sendEmail(verificationEmail(user.email, user.name, v.token));
}

export async function resendVerification(email: string) {
  const user = await users.findByEmail(email);
  if (!user || user.emailVerified || user.deletedAt) return;
  const v = newVerifyToken();
  await users.setVerifyToken(user.id, v.hash, v.expires);
  await sendEmail(verificationEmail(user.email, user.name, v.token));
}

// ─────────────────────────── Verification ───────────────────────────

const isBootstrapAdmin = (email: string) => env().adminEmails.includes(email.toLowerCase());

/**
 * Verifies the email (single-use hashed token) and starts the 7-day trial at
 * this moment, not at signup (defect #4). Re-verification after an email
 * change never restarts the trial.
 */
export async function verifyEmail(token: string, ip: string, res: NextApiResponse) {
  const user = await users.findByVerifyTokenHash(sha256(token));
  if (!user || !user.verifyTokenExpires || user.verifyTokenExpires < new Date() || user.deletedAt) {
    throw badRequest("This verification link is invalid or has expired. Request a new one from the sign-in page.");
  }
  const startTrial = !user.trialStartDate && user.subscriptionStatus === "none";
  const trial = startTrial ? trialWindow() : null;
  const makeAdmin = isBootstrapAdmin(user.email) && user.role !== "admin";
  const updated = await users.markVerified(user.id, trial, makeAdmin);
  await invalidateEntitlements(user.id);
  await audit("auth.verify", { actorUserId: user.id, targetType: "User", targetId: user.id, ip });
  if (makeAdmin) await audit("admin.role_change", { actorUserId: user.id, targetType: "User", targetId: user.id, meta: { to: "admin", via: "ADMIN_EMAILS" } });
  if (trial && updated.role !== "admin") await sendEmailSafe(welcomeTrialEmail(updated.email, updated.name, trial.end));
  await setSessionCookie(res, updated.id, updated.role, updated.sessionVersion);
  return updated;
}

// ───────────────────────────── Login ─────────────────────────────

const GENERIC = "Incorrect email or password.";
const failKey = (userId: string) => `loginfail:${userId}`;

export async function login(email: string, password: string, ip: string, res: NextApiResponse) {
  const user = await users.findByEmail(email);
  if (!user || user.deletedAt) {
    await burnPasswordCheck(password);
    await audit("auth.login_failed", { ip, meta: { reason: "unknown_email" } });
    throw unauthorized(GENERIC);
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(429, `Too many attempts. Try again in ${LOCKOUT_MINUTES} minutes, or reset your password.`, "ACCOUNT_LOCKED", undefined, {
      "Retry-After": String(Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)),
    });
  }
  if (!(await verifyPassword(user.passwordHash, password))) {
    // 8 failures inside a rolling 15 minutes (Redis) → lock (DB, authoritative).
    const fails = await kv().incr(failKey(user.id), LOCKOUT_MINUTES * 60);
    const lock = fails >= MAX_FAILED_LOGINS;
    await users.recordFailedLogin(user.id, fails, lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null);
    if (lock) await kv().del(failKey(user.id));
    await audit(lock ? "auth.locked" : "auth.login_failed", { actorUserId: user.id, targetType: "User", targetId: user.id, ip });
    throw unauthorized(GENERIC);
  }
  if (user.deactivatedAt) throw unauthorized(GENERIC);
  if (!user.emailVerified) {
    // Password was correct, so revealing this doesn't enumerate accounts.
    throw forbidden("Please confirm your email first. We can send a new link.", "EMAIL_NOT_VERIFIED");
  }

  let current = user;
  if (isBootstrapAdmin(user.email) && user.role !== "admin") {
    current = await users.markVerified(user.id, null, true);
    await audit("admin.role_change", { actorUserId: user.id, targetType: "User", targetId: user.id, meta: { to: "admin", via: "ADMIN_EMAILS" } });
  }
  if (user.failedLoginCount || user.lockedUntil) await users.clearFailedLogins(user.id);
  await kv().del(failKey(user.id));
  await setSessionCookie(res, current.id, current.role, current.sessionVersion);
  await audit("auth.login", { actorUserId: user.id, targetType: "User", targetId: user.id, ip });
  return current;
}

// ─────────────────────────── Password reset ───────────────────────────

export async function forgotPassword(email: string, ip: string) {
  const user = await users.findByEmail(email);
  if (!user || user.deletedAt || user.deactivatedAt) return;
  const token = randomToken();
  await users.setResetToken(user.id, sha256(token), new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000));
  await audit("auth.password_reset_requested", { actorUserId: user.id, targetType: "User", targetId: user.id, ip });
  await sendEmail(passwordResetEmail(user.email, user.name, token));
}

export async function resetPassword(token: string, newPassword: string, ip: string) {
  const user = await users.findByResetTokenHash(sha256(token));
  if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date() || user.deletedAt) {
    throw badRequest("This reset link is invalid or has expired. Please request a new one.");
  }
  await assertGoodPassword(newPassword, user.email);
  // Consumes the token, clears lockout, and bumps sessionVersion (signs out everywhere).
  await users.setPassword(user.id, await hashPassword(newPassword));
  await kv().del(failKey(user.id));
  await audit("auth.password_reset", { actorUserId: user.id, targetType: "User", targetId: user.id, ip });
  await sendEmailSafe(passwordChangedEmail(user.email, user.name));
}

export async function changePassword(user: User, currentPassword: string, newPassword: string, ip: string, res: NextApiResponse) {
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw badRequest("Your current password is incorrect.", [{ path: "currentPassword", message: "Incorrect password" }]);
  }
  await assertGoodPassword(newPassword, user.email);
  const updated = await users.setPassword(user.id, await hashPassword(newPassword));
  await setSessionCookie(res, updated.id, updated.role, updated.sessionVersion); // keep this device signed in
  await audit("auth.password_changed", { actorUserId: user.id, targetType: "User", targetId: user.id, ip });
  await sendEmailSafe(passwordChangedEmail(user.email, user.name));
}

export async function logoutAll(user: User, ip: string) {
  await users.bumpSessionVersion(user.id);
  await audit("auth.logout_all", { actorUserId: user.id, targetType: "User", targetId: user.id, ip });
}

/** Safe-to-return user shape. Never includes hashes, tokens or MFA material. */
export function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    emailVerified: u.emailVerified,
    subscriptionStatus: u.subscriptionStatus,
    subscriptionTier: u.subscriptionTier,
    trialEndDate: u.trialEndDate,
    mfaEnabled: u.mfaEnabled,
  };
}
