"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITED } from "@/lib/rate-limit";
import type { FormState } from "@/lib/form";
import { uuidSchema } from "@/lib/validation";
import { platformFeeCents } from "@/lib/money";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";

/**
 * Starts Stripe Checkout for a listing. The price always comes from the
 * database, never from the browser. Uses a "direct charge" on the seller's
 * connected Stripe account with a 7% application fee for the platform.
 */
export async function buyListing(listingId: string): Promise<FormState> {
  const account = await requireUser(`/marketplace/${listingId}`);
  if (!uuidSchema.safeParse(listingId).success) return { error: "Not found." };
  if (!env.stripeConfigured) return { error: "Checkout isn't available yet." };
  if (!(await rateLimit("checkout", 10, 3600, account.id))) return RATE_LIMITED;

  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, seller_id, title, price_cents, shipping_cents, currency, country, status")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || listing.status !== "active") return { error: "This item is no longer available." };
  if (listing.seller_id === account.id) return { error: "You can't buy your own listing." };

  const admin = createAdminClient();
  const { data: seller } = await admin
    .from("seller_accounts")
    .select("stripe_account_id, charges_enabled")
    .eq("user_id", listing.seller_id)
    .maybeSingle();
  if (!seller?.charges_enabled) return { error: "The seller can't accept online payments yet." };

  const total = listing.price_cents + listing.shipping_cents;
  const fee = platformFeeCents(total);

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      listing_id: listing.id,
      listing_title: listing.title,
      buyer_id: account.id,
      seller_id: listing.seller_id,
      amount_cents: total,
      platform_fee_cents: fee,
      currency: listing.currency,
      stripe_account_id: seller.stripe_account_id,
    })
    .select("id")
    .single();
  if (orderError || !order) return { error: "Couldn't start checkout. Please try again." };

  let url: string | null = null;
  try {
    const session = await stripe().checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: order.id,
        customer_email: account.email ?? undefined,
        line_items: [
          {
            quantity: 1,
            price_data: { currency: listing.currency, unit_amount: listing.price_cents, product_data: { name: listing.title } },
          },
          ...(listing.shipping_cents > 0
            ? [{ quantity: 1, price_data: { currency: listing.currency, unit_amount: listing.shipping_cents, product_data: { name: "Shipping" } } }]
            : []),
        ],
        ...(listing.shipping_cents > 0
          ? { shipping_address_collection: { allowed_countries: [listing.country as "US"] } }
          : {}),
        payment_intent_data: {
          application_fee_amount: fee,
          metadata: { order_id: order.id, listing_id: listing.id },
        },
        metadata: { order_id: order.id, listing_id: listing.id },
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        success_url: `${env.siteUrl}/orders?checkout=success`,
        cancel_url: `${env.siteUrl}/marketplace/${listing.id}`,
      },
      { stripeAccount: seller.stripe_account_id, idempotencyKey: `checkout-${order.id}` },
    );
    await admin.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", order.id);
    url = session.url;
  } catch (e) {
    console.error("checkout create failed", (e as { code?: string }).code);
    await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
  }
  if (!url) return { error: "Couldn't start checkout. Please try again." };
  redirect(url);
}
