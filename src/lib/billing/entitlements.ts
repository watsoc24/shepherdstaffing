import { users } from "../db";
import { kv } from "../security/redis";
import type { SubscriptionStatus, Role } from "../../generated/prisma/client";

/**
 * The single source of truth for what a user may do (spec §6). Resolved
 * server-side from the database on every request — never from the session
 * cookie (defect #3) — and cached for at most 60s. The Stripe webhook and any
 * subscription/trial change call invalidateEntitlements() so paying unlocks
 * access immediately, and an expiring trial is enforced mid-session.
 */

export const TRIAL_DAYS = 7;
export const TRIAL_CHAT_LIMIT = 10;
const CACHE_TTL_SECONDS = 60;

export type EntitlementState = "unverified" | "trial" | "paid" | "expired";

export interface Entitlements {
  state: EntitlementState;
  canEditProfile: boolean;
  canSeeMatchScores: boolean;
  canSeeMatchDetail: boolean;
  canBrowseListings: boolean;
  canSeeFullListings: boolean;
  canContact: boolean;
  chatRemaining: number | "unlimited";
  canTakeInterview: boolean;
  canViewInterviewResults: boolean;
  trialEndsAt: string | null;
  pastDue: boolean;
}

export type Capability = Exclude<keyof Entitlements, "state" | "chatRemaining" | "trialEndsAt" | "pastDue">;

interface Inputs {
  role: Role;
  emailVerified: boolean;
  subscriptionStatus: SubscriptionStatus;
  trialEndDate: Date | null;
  trialChatCount: number;
}

/** Pure function from user fields → entitlements. Exported for tests. */
export function computeEntitlements(u: Inputs, now = new Date()): Entitlements {
  const trialEndsAt = u.trialEndDate?.toISOString() ?? null;
  const none: Entitlements = {
    state: "unverified",
    canEditProfile: false,
    canSeeMatchScores: false,
    canSeeMatchDetail: false,
    canBrowseListings: false,
    canSeeFullListings: false,
    canContact: false,
    chatRemaining: 0,
    canTakeInterview: false,
    canViewInterviewResults: false,
    trialEndsAt,
    pastDue: false,
  };
  if (!u.emailVerified) return none;

  const paid =
    u.role === "admin" || u.subscriptionStatus === "active" || u.subscriptionStatus === "past_due"; // Stripe is still retrying
  if (paid) {
    return {
      state: "paid",
      canEditProfile: true,
      canSeeMatchScores: true,
      canSeeMatchDetail: true,
      canBrowseListings: true,
      canSeeFullListings: true,
      canContact: true,
      chatRemaining: "unlimited", // fair-use 60/hr enforced by the chat rate limit
      canTakeInterview: true,
      canViewInterviewResults: true,
      trialEndsAt,
      pastDue: u.subscriptionStatus === "past_due",
    };
  }

  const inTrial = u.subscriptionStatus === "trial" && !!u.trialEndDate && u.trialEndDate > now;
  if (inTrial) {
    return {
      ...none,
      state: "trial",
      canEditProfile: true,
      canSeeMatchScores: true,
      canSeeMatchDetail: true,
      canBrowseListings: true,
      chatRemaining: Math.max(0, TRIAL_CHAT_LIMIT - u.trialChatCount),
      canTakeInterview: true,
    };
  }

  // Trial over, cancelled, or never started: profile editing and bare scores only.
  return { ...none, state: "expired", canEditProfile: true, canSeeMatchScores: true };
}

const key = (userId: string) => `ent:v1:${userId}`;

export async function getEntitlements(userId: string): Promise<Entitlements> {
  const store = kv();
  const cached = await store.get<Entitlements>(key(userId));
  if (cached) {
    // A cached trial can't outlive its end date, even within the 60s window.
    if (cached.state !== "trial" || !cached.trialEndsAt || new Date(cached.trialEndsAt) > new Date()) return cached;
  }
  const user = await users.findById(userId);
  if (!user || user.deletedAt || user.deactivatedAt) {
    return computeEntitlements({ role: "candidate", emailVerified: false, subscriptionStatus: "none", trialEndDate: null, trialChatCount: 0 });
  }
  const ent = computeEntitlements(user);
  await store.set(key(userId), ent, CACHE_TTL_SECONDS);
  return ent;
}

export const invalidateEntitlements = (userId: string) => kv().del(key(userId));

export function trialWindow(start = new Date()) {
  return { start, end: new Date(start.getTime() + TRIAL_DAYS * 86_400_000) };
}
