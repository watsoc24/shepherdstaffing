import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Banner } from "@/components/Banner";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";
import { PLANS, type BillingInterval } from "@/lib/billing/stripe";

/**
 * M4 Billing — public pricing. One membership, two intervals: $49/month or
 * $299/year. Every account starts with a 7-day free trial at email
 * verification; membership is what unlocks contacting matches and full
 * listings. PreQual screening stays free.
 */
export default function Pricing() {
  const { user, entitlements } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<BillingInterval | null>(null);

  async function choose(interval: BillingInterval) {
    if (!user) {
      await router.push("/signup");
      return;
    }
    setBusy(interval);
    setError(null);
    try {
      const d = await apiFetch<{ url: string }>("/api/billing/checkout", { body: { interval } });
      window.location.href = d.url;
    } catch (err) {
      setError(err as ApiError);
      setBusy(null);
    }
  }

  const isPaid = entitlements?.state === "paid";

  return (
    <Layout title="Membership">
      <div className="container" style={{ padding: "48px 16px 64px" }}>
        <p className="label">Membership</p>
        <h1>One membership. Every match.</h1>
        <p style={{ maxWidth: 560 }}>
          Every account starts with a 7-day free trial when you verify your email. A membership is what lets you
          see matches in full and get in touch — and PreQual screening stays free either way.
        </p>
        {router.query.cancelled && <Banner tone="info">Checkout was cancelled — nothing was charged. Your trial keeps running.</Banner>}
        {isPaid && (
          <Banner tone="success">
            You already have a membership. Manage it in <Link href="/dashboard/billing">Billing</Link>.
          </Banner>
        )}
        {error && <Banner tone="error">{error.message}</Banner>}
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: 24 }}>
          {(Object.keys(PLANS) as BillingInterval[]).map((interval) => {
            const plan = PLANS[interval];
            return (
              <div className="card" key={interval}>
                <h2 style={{ margin: "0 0 4px" }}>{plan.label}</h2>
                <p style={{ fontSize: 28, fontWeight: 700, margin: "0 0 4px" }}>
                  ${plan.priceUsd} <span style={{ fontSize: 15, fontWeight: 400 }}>{plan.cadence}</span>
                </p>
                {interval === "annual" && <p className="muted">Two months free versus monthly.</p>}
                <ul>
                  <li>See matches in full</li>
                  <li>Contact matches</li>
                  <li>Unlimited ShepherdAI chat</li>
                  <li>Interviews and results</li>
                </ul>
                <button className="btn btn-primary btn-block" disabled={!!busy || isPaid} onClick={() => choose(interval)}>
                  {busy === interval ? "Starting checkout…" : user ? `Choose ${plan.label}` : "Start free trial"}
                </button>
              </div>
            );
          })}
        </div>
        <p className="muted" style={{ marginTop: 24 }}>
          Cancel anytime in Billing — access runs to the end of the paid period. Payments are processed by Stripe;
          Shepherd Staffing never sees your card number.
        </p>
      </div>
    </Layout>
  );
}
