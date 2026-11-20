import Link from "next/link";
import { Layout } from "@/components/Layout";

// M1 placeholder. The full landing page (hero → how it works → tiers → CTA) ships in a later milestone.
export default function Home() {
  return (
    <Layout dark>
      <section className="dark" style={{ padding: "64px 0 80px" }}>
        <div className="container">
          <div className="arch" style={{ background: "var(--ink-2)", padding: "48px 32px 40px" }}>
            <p className="label" style={{ color: "#d6d3d1" }}>Church recruiting, done with care</p>
            <h1>Find your best ministry fit.</h1>
            <p style={{ maxWidth: 560, color: "#e7e5e4" }}>
              Create a free profile and answer the questions for your church or your next role. We&apos;ll match you by percentage fit — candidates to ministry positions, churches to ministry candidates. The more accurate and detailed your profile, the better your matches.
            </p>
            <p style={{ maxWidth: 560, color: "#d6d3d1" }}>
              Free profiles can see a match&apos;s ministry type, organization size, and the first word of the role. Direct messaging takes a paid profile.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
              <Link className="btn btn-primary" href="/signup?role=church">I&apos;m a church</Link>
              <Link className="btn btn-ghost" style={{ color: "#faf7f2" }} href="/signup?role=candidate">I&apos;m a candidate</Link>
              <Link className="btn btn-ghost" style={{ color: "#faf7f2" }} href="/prequal">Try PreQual screening — free, 5 min</Link>
              <Link className="btn btn-ghost" style={{ color: "#faf7f2" }} href="/inquiry">Want us to run the search? Ask here</Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
