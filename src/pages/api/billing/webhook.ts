import type { NextApiRequest } from "next";
import type Stripe from "stripe";
import { api } from "@/lib/api/handler";
import { env } from "@/lib/env";
import { stripeEvents } from "@/lib/db";
import { getStripe } from "@/lib/billing/stripe";
import { markSubscriptionCancelled, syncSubscription, syncSubscriptionById } from "@/lib/billing/subscriptions";

/**
 * POST /api/billing/webhook — the only writer of subscription state.
 * Stripe signs every event; the signature is verified before anything else.
 * Each event id is claimed once (StripeEvent is the idempotency lock), so a
 * Stripe retry can never double-apply a payment. A claim is released if
 * processing fails, so the retry can succeed.
 *
 * This route must NOT go through the same-origin CSRF check (Stripe calls it
 * from outside) and must NOT parse the body as JSON (signature verification
 * needs the exact raw bytes). Hence bodyParser: false below.
 */
export const config = { api: { bodyParser: false } };

async function rawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks);
}

export default api(
  {
    POST: async (req, res) => {
      const stripe = getStripe();
      const secret = env().STRIPE_WEBHOOK_SECRET;
      if (!secret) {
        res.status(503).json({ error: { code: "BILLING_NOT_CONFIGURED", message: "Billing is not configured yet." } });
        return;
      }
      const sig = req.headers["stripe-signature"];
      if (typeof sig !== "string") {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: "Missing Stripe signature." } });
        return;
      }
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(await rawBody(req), sig, secret);
      } catch {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid Stripe signature." } });
        return;
      }

      const claimed = await stripeEvents.claim(event.id, event.type);
      if (!claimed) {
        res.status(200).json({ received: true, duplicate: true });
        return;
      }

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            if (typeof session.subscription === "string") await syncSubscriptionById(session.subscription);
            break;
          }
          case "customer.subscription.created":
          case "customer.subscription.updated": {
            await syncSubscription(event.data.object as Stripe.Subscription);
            break;
          }
          case "customer.subscription.deleted": {
            await markSubscriptionCancelled((event.data.object as Stripe.Subscription).id);
            break;
          }
          case "invoice.payment_failed": {
            const invoice = event.data.object as Stripe.Invoice;
            const subId = typeof invoice.subscription === "string" ? invoice.subscription : null;
            if (subId) await syncSubscriptionById(subId);
            break;
          }
          default:
            break; // Unknown event types are acknowledged, not retried.
        }
      } catch (err) {
        await stripeEvents.release(event.id);
        throw err; // → 500 via the api wrapper, so Stripe retries.
      }
      res.status(200).json({ received: true });
    },
  },
  { csrf: false },
);
