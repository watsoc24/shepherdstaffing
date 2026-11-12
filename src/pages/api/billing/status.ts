import { api } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { subscriptions } from "@/lib/db";
import { getEntitlements } from "@/lib/billing/entitlements";

/**
 * GET /api/billing/status — what the account/billing page shows: membership
 * state, the latest subscription row, and the trial end date. Read-only.
 */
export default api({
  GET: async (req, res) => {
    const ctx = await requireAuth(req, res);
    const ent = await getEntitlements(ctx.user.id);
    const sub = await subscriptions.latestForUser(ctx.user.id);
    res.status(200).json({
      state: ent.state,
      pastDue: ent.pastDue,
      trialEndsAt: ent.trialEndsAt,
      subscription: sub
        ? {
            tier: sub.tier,
            status: sub.status,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          }
        : null,
    });
  },
});
