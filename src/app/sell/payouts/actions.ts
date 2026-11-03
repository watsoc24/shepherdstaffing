"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITED } from "@/lib/rate-limit";
import type { FormState } from "@/lib/form";
import { COUNTRIES } from "@/lib/money";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";

/**
 * Creates (once) a Stripe connected account for the seller and sends them to
 * Stripe-hosted onboarding. Stripe collects identity and bank details —
 * we never see or store them.
 */
export async function startPayoutOnboarding(_: FormState, formData: FormData): Promise<FormState> {
  const account = await requireUser("/sell/payouts");
  if (!env.stripeConfigured) return { error: "Payouts aren't available yet." };
  if (!(await rateLimit("payout-onboarding", 10, 3600, account.id))) return RATE_LIMITED;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("seller_accounts")
    .select("stripe_account_id")
    .eq("user_id", account.id)
    .maybeSingle();

  let accountId = existing?.stripe_account_id;
  let onboardingUrl: string;
  try {
    if (!accountId) {
      const country = String(formData.get("country") ?? "");
      if (!COUNTRIES.some((c) => c.code === country)) return { error: "Choose your country." };
      const created = await stripe().accounts.create(
        {
          country,
          email: account.email ?? undefined,
          // Seller has their own full Stripe dashboard, pays Stripe's processing
          // fees, and Stripe (not the platform) covers negative balances.
          controller: {
            stripe_dashboard: { type: "full" },
            fees: { payer: "account" },
            losses: { payments: "stripe" },
            requirement_collection: "stripe",
          },
          metadata: { user_id: account.id },
        },
        { idempotencyKey: `connect-account-${account.id}` },
      );
      accountId = created.id;
      const { error } = await admin.from("seller_accounts").insert({ user_id: account.id, stripe_account_id: accountId });
      if (error) return { error: "Couldn't save your payout account. Please try again." };
    }
    const link = await stripe().accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${env.siteUrl}/sell/payouts`,
      return_url: `${env.siteUrl}/sell/payouts/return`,
    });
    onboardingUrl = link.url;
  } catch (e) {
    console.error("onboarding failed", (e as { code?: string }).code);
    return { error: "Stripe couldn't start onboarding. Please try again." };
  }
  redirect(onboardingUrl);
}
