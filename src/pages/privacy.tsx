import { Layout } from "@/components/Layout";
import { PRIVACY_VERSION } from "@/lib/legal";

/** Draft privacy policy (versioned in src/lib/legal.ts) — plain language, for the owner and their attorney to finalize. */
export default function Privacy() {
  return (
    <Layout title="Privacy policy">
      <div className="container" style={{ padding: "32px 16px 64px", maxWidth: 680 }}>
        <p className="label">Privacy policy — draft {PRIVACY_VERSION}</p>
        <h1>Privacy policy</h1>
        <p className="muted">Last updated: November 2026. This is a draft. Have it reviewed by an attorney before you rely on it.</p>

        <h2>What we collect</h2>
        <p>
          Your name, email, and role; what you put in your profile (public and private sections); PreQual
          screening answers; match scores; messages; interview answers and evaluations; subscription and
          payment status (payments themselves are handled by Stripe — we never see your card number); and the
          consents you accept. We also keep a security audit log: who signed in, what admins did, what was
          exported or deleted. The audit log never contains personal content.
        </p>

        <h2>How private things are protected</h2>
        <p>
          Private profile fields and interview answers are encrypted with AES-256-GCM before they are stored,
          and the key lives outside the database. Only you (and, for an evaluation, the recruiter scoring it)
          can read your interview answers. Churches see an evaluation only if you shared it with them. An
          admin reading a private field is written to the audit log. Passwords are hashed with bcrypt; admins
          must use two-factor authentication.
        </p>

        <h2>What we share</h2>
        <p>
          Public profile sections are shown to matches. Private sections are not. We share data with our
          processors only as the service needs it: Stripe (payments), Brevo (email), Supabase (database),
          Upstash (rate limits), and Anthropic (AI coaching and match narratives — public fields only, never
          private ones). We do not sell personal data.
        </p>

        <h2>Your choices</h2>
        <p>
          You can download everything we hold about you from your Account page, and you can close your account
          there too. Closing an account revokes your sessions and marks your data for deletion; personal data
          is purged within 30 days (see docs/RETENTION.md). Anonymized audit records and financial records we
          are legally required to keep are the exceptions.
        </p>

        <h2>How long we keep things</h2>
        <p>
          Active accounts: as long as you use the service. Closed accounts: personal data purged within 30
          days. Inquiries and engagements: kept for the length of the engagement plus 2 years for records.
          Audit logs: 1 year, without personal content.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about your data: support@fitforministry.com (placeholder — see Decision #5).
        </p>
      </div>
    </Layout>
  );
}
