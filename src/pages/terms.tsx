import { Layout } from "@/components/Layout";
import { TERMS_VERSION } from "@/lib/legal";

/**
 * Draft terms (versioned in src/lib/legal.ts). Plain language, for the owner
 * and their attorney to finalize before launch — the brand name and support
 * email are placeholders (see src/lib/brand.ts, Decision #5).
 */
export default function Terms() {
  return (
    <Layout title="Terms of service">
      <div className="container" style={{ padding: "32px 16px 64px", maxWidth: 680 }}>
        <p className="label">Terms of service — draft {TERMS_VERSION}</p>
        <h1>Terms of service</h1>
        <p className="muted">Last updated: November 2026. This is a draft. Have it reviewed by an attorney before you rely on it.</p>

        <h2>1. What Fit For Ministry is</h2>
        <p>
          Fit For Ministry connects churches hiring for ministry roles with candidates seeking them. We provide
          profiles, screening, matching, messaging, and a structured interview. For some churches we run the
          search ourselves (assisted or full service). We are a recruiting platform, not an employer: we do
          not hire, employ, or supervise anyone, and a match or an interview score is not a hiring decision.
        </p>

        <h2>2. Your account</h2>
        <p>
          You must be 18 or older, give accurate information, and keep your password private. You are
          responsible for what happens under your account. We may suspend or close accounts that misuse the
          service, harass other members, or post false information.
        </p>

        <h2>3. Membership and payment</h2>
        <p>
          Membership is $49 a month or $299 a year, billed through Stripe. The first 7 days are a free trial.
          You can cancel in your dashboard at any time; cancellation takes effect at the end of the paid period.
          Assisted and full-search engagements are priced separately and agreed in writing before work begins.
        </p>

        <h2>4. Your content</h2>
        <p>
          You keep ownership of what you write — profiles, answers, messages. By posting it here you let us
          show it to the people the service is for (matches, and churches you share an interview evaluation
          with), and to run the service itself. Interview answers are never shown to churches; only the
          evaluation is, and only where you shared it.
        </p>

        <h2>5. What we do not promise</h2>
        <p>
          We do not promise a hire, a placement, or a particular outcome. Scores, rankings, and AI-written
          notes are aids to judgement, not judgements. Churches and candidates make their own hiring decisions,
          including reference and background checks where those apply.
        </p>

        <h2>6. Acceptable use</h2>
        <p>
          No harassment, no discrimination in hiring, no false statements about yourself or anyone else, no
          scraping or automated collection of other members&apos; information, and no use of the service for
          any purpose other than church hiring.
        </p>

        <h2>7. Liability</h2>
        <p>
          The service is provided as-is. To the fullest extent the law allows, our liability is limited to
          the fees you paid us in the 12 months before the claim.
        </p>

        <h2>8. Changes</h2>
        <p>
          We may update these terms. When we do, the version number changes and we will tell you at sign-in.
          Continuing to use the service after a change means you accept it.
        </p>

        <p className="muted">
          Questions: support@fitforministry.com (placeholder — see Decision #5).
        </p>
      </div>
    </Layout>
  );
}
