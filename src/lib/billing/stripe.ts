import Stripe from "stripe";
import { env } from "../env";
import { HttpError } from "../api/errors";

/**
 * M4 Billing — Stripe client and plan prices. Test-mode keys until launch
 * (see .env.example). Prices live in env, never in code, so a price change
 * is a config change, not a deploy.
 */

export type BillingInterval = "monthly" | "annual";

export const PLANS: Record<BillingInterval, { label: string; priceUsd: number; cadence: string }> = {
  monthly: { label: "Monthly", priceUsd: 49, cadence: "per month" },
  annual: { label: "Annual", priceUsd: 299, cadence: "per year" },
};

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const secret = env().STRIPE_SECRET_KEY;
  if (!secret) {
    throw new HttpError(503, "Billing is not configured yet. Add Stripe keys to start a membership.", "BILLING_NOT_CONFIGURED");
  }
  if (!client) {
    // No apiVersion pinned: the SDK uses its bundled default, so a wrong
    // guessed version string can never break the client at runtime.
    client = new Stripe(secret);
  }
  return client;
}

export function getPriceId(interval: BillingInterval): string {
  const e = env();
  const id = interval === "monthly" ? e.STRIPE_PRICE_PLATFORM_MONTHLY : e.STRIPE_PRICE_PLATFORM_ANNUAL;
  if (!id) {
    throw new HttpError(
      503,
      `Billing is not configured yet. Add the ${interval} Stripe price to start a membership.`,
      "BILLING_NOT_CONFIGURED",
    );
  }
  return id;
}

export const appUrl = () => env().NEXT_PUBLIC_APP_URL;
