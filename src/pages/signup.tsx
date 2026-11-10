import { useRouter } from "next/router";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AuthCard } from "@/components/AuthCard";
import { Field } from "@/components/Field";
import { Banner } from "@/components/Banner";
import { apiFetch, fieldError, type ApiError } from "@/lib/client/apiFetch";

export default function Signup() {
  const router = useRouter();
  const [role, setRole] = useState<"candidate" | "church">("candidate");
  const [form, setForm] = useState({ name: "", email: "", password: "", acceptTerms: false });
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (router.query.role === "church" || router.query.role === "candidate") setRole(router.query.role);
  }, [router.query.role]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/auth/signup", { body: { ...form, role } });
      setDone(true);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthCard title="Check your email">
        <p>We&apos;ve sent a confirmation link to <strong>{form.email}</strong>. Your 7-day free trial starts when you confirm.</p>
        <p className="muted">No email after a few minutes? Check spam, or <Link href="/login">request a new link</Link>.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" intro="7-day free trial. No credit card.">
      <form onSubmit={submit} noValidate>
        <p className="label" id="role-label">I am</p>
        <div className="segmented" role="group" aria-labelledby="role-label">
          <button type="button" aria-pressed={role === "candidate"} onClick={() => setRole("candidate")}>A candidate</button>
          <button type="button" aria-pressed={role === "church"} onClick={() => setRole("church")}>A church</button>
        </div>
        {error && !error.details && <Banner tone="error">{error.message}</Banner>}
        <Field label={role === "church" ? "Your name (church contact)" : "Full name"} autoComplete="name" required
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fieldError(error, "name")} />
        <Field label="Email" type="email" autoComplete="email" inputMode="email" required
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={fieldError(error, "email")} />
        <Field label="Password" type="password" autoComplete="new-password" required minLength={10}
          hint="At least 10 characters. A short phrase works well."
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={fieldError(error, "password")} />
        <label className="checkbox">
          <input type="checkbox" checked={form.acceptTerms} onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })} />
          <span>I agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</span>
        </label>
        {fieldError(error, "acceptTerms") && <p className="field-error" role="alert">{fieldError(error, "acceptTerms")}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      </form>
      <p style={{ marginTop: 16 }}>Already have an account? <Link href="/login">Sign in</Link></p>
    </AuthCard>
  );
}
