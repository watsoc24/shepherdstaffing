import { NextResponse, type NextRequest } from "next/server";
import { getAccount } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

/** Stripe sends sellers back here after onboarding; refresh their status. */
export async function GET(request: NextRequest) {
  const account = await getAccount();
  const back = new URL("/sell/payouts", request.nextUrl.origin);
  if (!account) return NextResponse.redirect(new URL("/login?next=/sell/payouts", request.nextUrl.origin));
  const admin = createAdminClient();
  const { data: row } = await admin.from("seller_accounts").select("stripe_account_id").eq("user_id", account.id).maybeSingle();
  if (row) {
    try {
      const acct = await stripe().accounts.retrieve(row.stripe_account_id);
      await admin
        .from("seller_accounts")
        .update({
          charges_enabled: acct.charges_enabled,
          payouts_enabled: acct.payouts_enabled,
          details_submitted: acct.details_submitted,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", account.id);
    } catch {
      // The account.updated webhook will catch up.
    }
  }
  return NextResponse.redirect(back);
}
