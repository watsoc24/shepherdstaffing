import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Banner } from "@/components/Banner";
import { requirePageAuth } from "@/lib/auth/ssr";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";

export const getServerSideProps: GetServerSideProps = (ctx) => requirePageAuth(ctx);

type BillingStatus = {
  state: string;
  pastDue: boolean;
  trialEndsAt: string | null;
  subscription: { tier: string; status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null } | null;
};

/** M4 Billing — the member's billing page: plan, trial, and the Stripe portal. */
export default function Billing() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<BillingStatus>("/api/billing/status")
      .then((d) => {
        if (!cancelled) setStatus(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e as ApiError);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function manage() {
    setBusy(true);
    setError(null);
    try {
      const d = await apiFetch<{ url: string }>("/api/billing/portal", { method: "POST" });
      window.location.href = d.url;
    } catch (err) {
      setError(err as ApiError);
      setBusy(false);
    }
  }

  return (
    <Layout title="Billing">
      <div className="container" style={{ padding: "32px 16px 64px" }}>
        <p className="label">Billing</p>
        <h1>Your membership</h1>
        {error && <Banner tone="error">{error.message}</Banner>}
        {!status ? (
          <p>Loading…</p>
        ) : (
          <>
            <p>
              Status: <strong>{status.state}</strong>
              {status.pastDue ? " — a payment failed, please update your card below." : ""}
            </p>
            {status.state === "trial" && status.trialEndsAt && (
              <p>Trial ends {new Date(status.trialEndsAt).toLocaleDateString()}. Choose a plan before then to keep full access.</p>
            )}
            {status.subscription ? (
              <p>
                Plan: {status.subscription.tier} · {status.subscription.status}
                {status.subscription.currentPeriodEnd &&
                  ` · Renews ${new Date(status.subscription.currentPeriodEnd).toLocaleDateString()}`}
                {status.subscription.cancelAtPeriodEnd && " · Cancels at the end of this period"}
              </p>
            ) : (
              <p>No membership yet.</p>
            )}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              {status.subscription ? (
                <button className="btn btn-primary" disabled={busy} onClick={manage}>
                  {busy ? "Opening…" : "Manage card, plan, or cancel"}
                </button>
              ) : (
                <Link className="btn btn-primary" href="/pricing">
                  See plans
                </Link>
              )}
              <Link className="btn btn-ghost" href="/dashboard">
                Back to dashboard
              </Link>
            </div>
            <p className="muted" style={{ marginTop: 16 }}>
              Payments are processed by Stripe. Cancelling keeps your access until the end of the paid period, and
              your profile stays safe.
            </p>
          </>
        )}
      </div>
    </Layout>
  );
}
