import Link from "next/link";
import { Layout } from "@/components/Layout";

/** Landing page after a successful Stripe checkout. Access itself is granted by the webhook, not by this page. */
export default function BillingSuccess() {
  return (
    <Layout title="Welcome to your membership">
      <div className="container" style={{ padding: "48px 16px 64px" }}>
        <h1>Welcome to your membership.</h1>
        <p>
          Your payment went through. Your membership activates as soon as Stripe confirms it — usually within a
          few seconds. If the dashboard still shows your trial, wait a moment and refresh.
        </p>
        <Link className="btn btn-primary" href="/dashboard">
          Go to your dashboard
        </Link>
      </div>
    </Layout>
  );
}
