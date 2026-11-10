import { beforeEach, describe, expect, it } from "vitest";
import { computeEntitlements, getEntitlements, invalidateEntitlements } from "@/lib/billing/entitlements";
import { requireEntitlement } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db";
import { memoryKv } from "@/lib/security/redis";
import { resetDb } from "./helpers";

const DAY = 86_400_000;
const base = { role: "candidate" as const, emailVerified: true, trialChatCount: 0 };

describe("computeEntitlements (spec §6 table)", () => {
  it("unverified users can do nothing", () => {
    const e = computeEntitlements({ ...base, emailVerified: false, subscriptionStatus: "trial", trialEndDate: new Date(Date.now() + DAY) });
    expect(e.state).toBe("unverified");
    expect(e.canEditProfile).toBe(false);
  });

  it("trial: browse anonymized, see scores, 10 chats, no contact", () => {
    const e = computeEntitlements({ ...base, subscriptionStatus: "trial", trialEndDate: new Date(Date.now() + DAY), trialChatCount: 3 });
    expect(e).toMatchObject({
      state: "trial",
      canBrowseListings: true,
      canSeeFullListings: false,
      canContact: false,
      chatRemaining: 7,
      canTakeInterview: true,
      canViewInterviewResults: false,
    });
  });

  it("expired trial: profile + bare scores only", () => {
    const e = computeEntitlements({ ...base, subscriptionStatus: "trial", trialEndDate: new Date(Date.now() - 1000) });
    expect(e).toMatchObject({
      state: "expired",
      canEditProfile: true,
      canSeeMatchScores: true,
      canSeeMatchDetail: false,
      canBrowseListings: false,
      canContact: false,
      chatRemaining: 0,
      canTakeInterview: false,
    });
  });

  it("cancelled behaves like expired; past_due keeps access with a flag", () => {
    expect(computeEntitlements({ ...base, subscriptionStatus: "cancelled", trialEndDate: null }).state).toBe("expired");
    const pd = computeEntitlements({ ...base, subscriptionStatus: "past_due", trialEndDate: null });
    expect(pd.state).toBe("paid");
    expect(pd.pastDue).toBe(true);
  });

  it("paid: everything, unlimited chat", () => {
    const e = computeEntitlements({ ...base, subscriptionStatus: "active", trialEndDate: null });
    expect(e).toMatchObject({ state: "paid", canContact: true, canSeeFullListings: true, chatRemaining: "unlimited", canViewInterviewResults: true });
  });
});

describe("server-side resolution (defect #3)", () => {
  beforeEach(async () => {
    await resetDb();
    memoryKv.clear();
  });

  async function trialUser() {
    return db().user.create({
      data: {
        email: "t@x.com",
        passwordHash: "x",
        name: "T",
        role: "candidate",
        emailVerified: true,
        subscriptionStatus: "trial",
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 3 * DAY),
      },
    });
  }

  it("paying unlocks immediately for an existing session once the webhook invalidates the cache", async () => {
    const u = await trialUser();
    expect((await getEntitlements(u.id)).canContact).toBe(false); // now cached
    await users.setSubscription(u.id, "active", "platform_monthly");
    await invalidateEntitlements(u.id); // what the Stripe webhook does
    expect((await getEntitlements(u.id)).canContact).toBe(true);
  });

  it("a trial that ends mid-session is enforced even if cached", async () => {
    const u = await trialUser();
    await getEntitlements(u.id);
    await db().user.update({ where: { id: u.id }, data: { trialEndDate: new Date(Date.now() - 1000) } });
    // Simulate a cached trial whose end date has now passed.
    const cached = await memoryKv.get<{ trialEndsAt: string }>(`ent:v1:${u.id}`);
    await memoryKv.set(`ent:v1:${u.id}`, { ...cached, trialEndsAt: new Date(Date.now() - 1000).toISOString() }, 60);
    expect((await getEntitlements(u.id)).state).toBe("expired");
  });

  it("requireEntitlement throws 403 UPGRADE_REQUIRED for trial contact attempts", async () => {
    const u = await trialUser();
    const ctx = { user: u, entitlements: await getEntitlements(u.id) };
    try {
      requireEntitlement(ctx, "canContact");
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as { status: number }).status).toBe(403);
      expect((e as { code: string }).code).toBe("UPGRADE_REQUIRED");
    }
  });

  it("deactivated users have no entitlements", async () => {
    const u = await trialUser();
    await users.deactivate(u.id);
    expect((await getEntitlements(u.id)).state).toBe("unverified");
  });
});
