import { api, limit } from "@/lib/api/handler";
import { badRequest } from "@/lib/api/errors";
import { requireAuth } from "@/lib/auth/guards";
import { appUrl, getStripe } from "@/lib/billing/stripe";

/**
 * POST /api/billing/portal — open Stripe's customer portal, where the member
 * updates their card, changes plan, or cancels. Cancellation itself is
 * handled by Stripe and lands back here through the webhook.
 */
export default api({
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    await limit("billingPortal", `user:${ctx.user.id}`);
    if (!ctx.user.stripeCustomerId) {
      throw badRequest("No membership to manage yet. Choose a plan first.");
    }
    const session = await getStripe().billingPortal.sessions.create({
      customer: ctx.user.stripeCustomerId,
      return_url: `${appUrl()}/dashboard/billing`,
    });
    res.status(200).json({ url: session.url });
  },
});
