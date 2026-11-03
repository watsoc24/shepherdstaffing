import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { Select } from "@/components/fields";
import { COUNTRIES } from "@/lib/money";
import { env } from "@/lib/env";
import { startPayoutOnboarding } from "./actions";

export const metadata = { title: "Get paid" };

export default async function PayoutsPage() {
  const account = await requireUser("/sell/payouts");
  const supabase = await createClient();
  const { data: seller } = await supabase
    .from("seller_accounts")
    .select("charges_enabled, payouts_enabled, details_submitted")
    .eq("user_id", account.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="page-title">Get paid for your sales</h1>
      {!env.stripeConfigured ? (
        <p className="card text-gray-600">Online payments haven&apos;t been switched on yet.</p>
      ) : seller?.charges_enabled ? (
        <div className="card space-y-2">
          <p className="font-semibold text-brand-700">You&apos;re set up to accept payments.</p>
          <p className="text-sm text-gray-600">
            Payouts {seller.payouts_enabled ? "are enabled" : "are pending Stripe review"}. Manage bank details and see
            payouts in your Stripe dashboard at dashboard.stripe.com.
          </p>
        </div>
      ) : (
        <div className="card space-y-3">
          <p className="text-sm text-gray-700">
            We use Stripe to pay sellers. Stripe will ask for your name, date of birth, address and bank details to
            verify your identity — we never see these.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Platform fee: 7% of each sale (item + shipping).</li>
            <li>Stripe also charges its standard card processing fee, deducted from your payout.</li>
          </ul>
          <ActionForm action={startPayoutOnboarding} submitLabel={seller ? "Continue Stripe setup" : "Set up payouts with Stripe"}>
            {!seller ? (
              <Select label="Country where you live" name="country" options={COUNTRIES.map((c) => [c.code, c.name] as const)} defaultValue="US" />
            ) : null}
          </ActionForm>
        </div>
      )}
    </div>
  );
}
