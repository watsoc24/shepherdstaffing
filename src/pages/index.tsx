import Link from "next/link";
import { Layout } from "@/components/Layout";

// M1 placeholder. The full landing page (hero → how it works → tiers → CTA) ships in a later milestone.
export default function Home() {
  return (
    <Layout dark>
      <section className="dark" style={{ padding: "64px 0 80px" }}>
        <div className="container">
          <p className="label" style={{ color: "#d6d3d1" }}>Church recruiting, done with care</p>
          <h1>Finding the right shepherd is sacred work.</h1>
          <p style={{ maxWidth: 560, color: "#e7e5e4" }}>
            Detailed profiles, honest AI-assisted matching, and recruiters who know ministry.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
            <Link className="btn btn-primary" href="/signup?role=church">I&apos;m a church</Link>
            <Link className="btn btn-ghost" style={{ color: "#faf7f2" }} href="/signup?role=candidate">I&apos;m a candidate</Link>
            <Link className="btn btn-ghost" style={{ color: "#faf7f2" }} href="/prequal">Try PreQual screening — free, 5 min</Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
