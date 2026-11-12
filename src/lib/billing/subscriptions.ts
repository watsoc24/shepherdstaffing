import type Stripe from "stripe";
import { subscriptions, users } from "../db";
import type { SubscriptionStatus } from "../../generated/prisma/client";
import { getStripe } from "./stripe";
import { invalidateEntitlements } from "./entitlements";

/**
 * M4 Billing — keeps our subscription rows in step with Stripe. The webhook
 * is the only writer: checkout never writes subscription state directly,
 * because a checkout can be abandoned or a payment can fail after the
 * redirect. Every sync re-derives the user's entitlements right away.
 */

export const TIER_PLATFORM = "platform";

/** Stripe's subscription statuses → our SubscriptionStatus enum. Pure, tested. */
export function statusFromStripe(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trial";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "cancelled";
    case "incomplete":
    case "incomplete_expired":
      return "none";
    case "unpaid":
      return "expired";
    case "paused":
      return "cancelled";
    default:
      return "none";
  }
}

/** Upsert the subscription row and mirror its status onto the user, then unlock entitlements. */
export async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const user = await users.findByStripeCustomerId(customerId);
  if (!user) return; // Not our customer (e.g. a test-mode stranger) — nothing to sync.
  const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  await subscriptions.upsert({
    userId: user.id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    tier: TIER_PLATFORM,
    status: sub.status,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodEnd,
  });
  await users.setSubscription(user.id, statusFromStripe(sub.status), TIER_PLATFORM);
  await invalidateEntitlements(user.id);
}

/** Fetch a subscription from Stripe and sync it. Used by webhook events that carry only an id. */
export async function syncSubscriptionById(subscriptionId: string): Promise<void> {
  const sub = await getStripe().subscriptions.retrieve(subscriptionId);
  await syncSubscription(sub);
}

/** Hard-cancel path: subscription deleted in Stripe with no row to upsert from. */
export async function markSubscriptionCancelled(stripeSubscriptionId: string): Promise<void> {
  const row = await subscriptions.findByStripeId(stripeSubscriptionId);
  if (!row) return;
  await users.setSubscription(row.userId, "cancelled", TIER_PLATFORM);
  await invalidateEntitlements(row.userId);
}
