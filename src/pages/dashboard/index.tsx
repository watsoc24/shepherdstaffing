import type { GetServerSideProps } from "next";
import Link from "next/link";
import { Layout } from "@/components/Layout";
import { TrialBanner } from "@/components/TrialBanner";
import { requirePageAuth } from "@/lib/auth/ssr";
import type { ClientEntitlements, SessionUser } from "@/context/AuthContext";

export const getServerSideProps: GetServerSideProps = (ctx) => requirePageAuth(ctx);

export default function Dashboard({ user, entitlements }: { user: SessionUser; entitlements: ClientEntitlements }) {
  const profileHref = user.role === "church" ? "/dashboard/church" : user.role === "candidate" ? "/dashboard/candidate" : "/admin";
  return (
    <Layout title="Dashboard">
      <div className="container" style={{ padding: "32px 16px 64px" }}>
        <TrialBanner entitlements={entitlements} />
        <h1>Welcome, {user.name.split(" ")[0]}.</h1>
        <p className="muted">Detail drives matching. The more specific your profile, the better your matches.</p>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 24 }}>
          <Link className="card" href={profileHref}><strong>Your profile</strong><br /><span className="muted">Public and private sections</span></Link>
          <Link className="card" href="/dashboard/matches"><strong>Matches</strong><br /><span className="muted">AI compatibility scores</span></Link>
          <Link className="card" href="/dashboard/prequal"><strong>PreQual assessments</strong><br /><span className="muted">Screening scores, best first</span></Link>
          <Link className="card" href="/dashboard/messages"><strong>Messages</strong><br /><span className="muted">Conversations with matches</span></Link>
          <Link className="card" href="/dashboard/chat"><strong>ShepherdAI</strong><br /><span className="muted">Coaching on your search</span></Link>
          <Link className="card" href="/dashboard/account"><strong>Account</strong><br /><span className="muted">Password, billing, your data</span></Link>
        </div>
      </div>
    </Layout>
  );
}
