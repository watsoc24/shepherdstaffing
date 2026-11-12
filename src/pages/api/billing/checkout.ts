import { z } from "zod";
import { api, limit, parseBody } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { users } from "@/lib/db";
import { appUrl, getPriceId, getStripe, type BillingInterval } from "@/lib/billing/stripe";

const schema = z.object({ interval: z.enum(["monthly", "annual"]) });

/**
 * POST /api/billing/checkout — start a membership. Creates (or reuses) the
 * Stripe customer, then a Checkout Session for the chosen plan. Nothing
 * about the subscription is written to our DB here: the webhook records it
 * when Stripe confirms payment, so an abandoned checkout never grants access.
 */
export default api({
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    await limit("billingCheckout", `user:${ctx.user.id}`);
    const body = parseBody(req, schema);
    const interval = body.interval as BillingInterval;
    const stripe = getStripe();

    let customerId = ctx.user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: ctx.user.email, name: ctx.user.name });
      customerId = customer.id;
      await users.setStripeCustomerId(ctx.user.id, customerId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: getPriceId(interval), quantity: 1 }],
      success_url: `${appUrl()}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/pricing?cancelled=1`,
      metadata: { userId: ctx.user.id, interval },
    });
    res.status(200).json({ url: session.url });
  },
});
