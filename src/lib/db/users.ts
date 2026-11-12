import { db } from "./client";
import type { Role, SubscriptionStatus } from "../../generated/prisma/client";
import { normalizeEmail } from "../security/sanitize";

export const findById = (id: string) => db().user.findUnique({ where: { id } });
export const findByEmail = (email: string) => db().user.findUnique({ where: { email: normalizeEmail(email) } });
export const findByVerifyTokenHash = (hash: string) => db().user.findUnique({ where: { verifyTokenHash: hash } });
export const findByResetTokenHash = (hash: string) => db().user.findUnique({ where: { resetTokenHash: hash } });
export const findByStripeCustomerId = (id: string) => db().user.findUnique({ where: { stripeCustomerId: id } });

export function create(input: {
  email: string;
  passwordHash: string;
  name: string;
  role: Exclude<Role, "admin">;
  verifyTokenHash: string;
  verifyTokenExpires: Date;
}) {
  return db().user.create({ data: { ...input, email: normalizeEmail(input.email) } });
}

/** Single-use: clears the token in the same write that verifies and starts the trial. */
export function markVerified(id: string, trial: { start: Date; end: Date } | null, makeAdmin = false) {
  return db().user.update({
    where: { id },
    data: {
      emailVerified: true,
      verifyTokenHash: null,
      verifyTokenExpires: null,
      ...(trial ? { trialStartDate: trial.start, trialEndDate: trial.end, subscriptionStatus: "trial" } : {}),
      ...(makeAdmin ? { role: "admin" } : {}),
    },
  });
}

export const setVerifyToken = (id: string, hash: string, expires: Date) =>
  db().user.update({ where: { id }, data: { verifyTokenHash: hash, verifyTokenExpires: expires } });

export const setResetToken = (id: string, hash: string, expires: Date) =>
  db().user.update({ where: { id }, data: { resetTokenHash: hash, resetTokenExpires: expires } });

/** Sets a new password, consumes the reset token, clears lockout and revokes all sessions. */
export const setPassword = (id: string, passwordHash: string) =>
  db().user.update({
    where: { id },
    data: {
      passwordHash,
      resetTokenHash: null,
      resetTokenExpires: null,
      failedLoginCount: 0,
      lockedUntil: null,
      sessionVersion: { increment: 1 },
    },
  });

export const recordFailedLogin = (id: string, failedLoginCount: number, lockedUntil: Date | null) =>
  db().user.update({ where: { id }, data: { failedLoginCount, lockedUntil } });

export const clearFailedLogins = (id: string) =>
  db().user.update({ where: { id }, data: { failedLoginCount: 0, lockedUntil: null } });

export const bumpSessionVersion = (id: string) =>
  db().user.update({ where: { id }, data: { sessionVersion: { increment: 1 } } });

export const setSubscription = (id: string, status: SubscriptionStatus, tier?: string | null) =>
  db().user.update({ where: { id }, data: { subscriptionStatus: status, subscriptionTier: tier } });

export const setStripeCustomerId = (id: string, stripeCustomerId: string) =>
  db().user.update({ where: { id }, data: { stripeCustomerId } });

/** Atomic increment so concurrent chat requests can't exceed the trial cap. */
export async function incrementTrialChat(id: string, cap: number): Promise<boolean> {
  const res = await db().user.updateMany({
    where: { id, trialChatCount: { lt: cap } },
    data: { trialChatCount: { increment: 1 } },
  });
  return res.count === 1;
}

export const updateName = (id: string, name: string) => db().user.update({ where: { id }, data: { name } });
export const updateEmail = (id: string, email: string, verifyTokenHash: string, verifyTokenExpires: Date) =>
  db().user.update({
    where: { id },
    data: { email: normalizeEmail(email), emailVerified: false, verifyTokenHash, verifyTokenExpires },
  });

export const setMfa = (
  id: string,
  data: Partial<{ mfaEnabled: boolean; mfaSecretEnc: string | null; mfaPendingSecretEnc: string | null; mfaBackupCodeHashes: string[]; mfaLastStep: number | null }>,
) => db().user.update({ where: { id }, data });

export const extendTrial = (id: string, trialEndDate: Date) =>
  db().user.update({ where: { id }, data: { trialEndDate, subscriptionStatus: "trial", trialReminderSentAt: null, trialExpiredSentAt: null } });

export const deactivate = (id: string) =>
  db().user.update({ where: { id }, data: { deactivatedAt: new Date(), sessionVersion: { increment: 1 } } });

export const hardDelete = (id: string) => db().user.delete({ where: { id } });

export const setRole = (id: string, role: "candidate" | "church" | "admin") => db().user.update({ where: { id }, data: { role } });

/** Admin list: no password hashes, no tokens — only what an admin needs to see. */
export const listRecent = (take = 50) =>
  db().user.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, email: true, name: true, role: true, emailVerified: true, subscriptionStatus: true, trialEndDate: true, deactivatedAt: true, createdAt: true },
  });

/** Trial users whose trial ends within [from, to). Used by the reminder cron. */
export const trialsEndingBetween = (from: Date, to: Date) =>
  db().user.findMany({
    where: { subscriptionStatus: "trial", trialEndDate: { gte: from, lt: to }, trialReminderSentAt: null, deletedAt: null },
  });

export const expiredTrials = (now: Date) =>
  db().user.findMany({ where: { subscriptionStatus: "trial", trialEndDate: { lt: now }, deletedAt: null } });

export const markTrialReminderSent = (id: string) =>
  db().user.update({ where: { id }, data: { trialReminderSentAt: new Date() } });

export const markTrialExpired = (id: string) =>
  db().user.update({ where: { id }, data: { subscriptionStatus: "expired", trialExpiredSentAt: new Date() } });
