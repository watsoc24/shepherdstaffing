import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe webhook (Connect endpoint: "events on connected accounts").
 * Every request is signature-verified before anything is trusted.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });
  const body = await request.text();
  if (body.length > 1_000_000) return NextResponse.json({ error: "too large" }, { status: 413 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, env.stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.payment_status !== "paid") break;
        const orderId = session.metadata?.order_id;
        if (!orderId) break;
        const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

        // Only transition pending -> paid for the exact session we created (idempotent).
        const { data: orders } = await admin
          .from("orders")
          .update({ status: "paid", paid_at: new Date().toISOString(), stripe_payment_intent_id: paymentIntent ?? null })
          .eq("id", orderId)
          .eq("stripe_checkout_session_id", session.id)
          .eq("status", "pending")
          .select("id, listing_id");
        const order = orders?.[0];
        if (!order?.listing_id) break;

        const { data: sold } = await admin
          .from("listings")
          .update({ status: "sold" })
          .eq("id", order.listing_id)
          .eq("status", "active")
          .select("id");
        if (!sold?.length && paymentIntent && event.account) {
          // Someone else bought it first: refund this buyer in full, including our fee.
          await stripe().refunds.create(
            { payment_intent: paymentIntent, refund_application_fee: true, reason: "requested_by_customer" },
            { stripeAccount: event.account, idempotencyKey: `refund-${order.id}` },
          );
          await admin.from("orders").update({ status: "refunded" }).eq("id", order.id);
        }
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object;
        await admin
          .from("orders")
          .update({ status: "cancelled" })
          .eq("stripe_checkout_session_id", session.id)
          .eq("status", "pending");
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object;
        if (charge.refunded && typeof charge.payment_intent === "string") {
          await admin.from("orders").update({ status: "refunded" }).eq("stripe_payment_intent_id", charge.payment_intent);
        }
        break;
      }
      case "account.updated": {
        const acct = event.data.object;
        await admin
          .from("seller_accounts")
          .update({
            charges_enabled: acct.charges_enabled,
            payouts_enabled: acct.payouts_enabled,
            details_submitted: acct.details_submitted,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_account_id", acct.id);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("webhook handling failed", event.type, (e as Error).message);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
