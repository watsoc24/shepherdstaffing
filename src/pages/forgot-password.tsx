import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/AuthCard";
import { Field } from "@/components/Field";
import { Banner } from "@/components/Banner";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ message: string }>("/api/auth/forgot-password", { body: { email } });
      setMsg(r.message);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Reset your password" intro="Enter your email and we'll send a link that works for one hour.">
      {msg ? (
        <Banner tone="success">{msg}</Banner>
      ) : (
        <form onSubmit={submit} noValidate>
          {error && <Banner tone="error">{error.message}</Banner>}
          <Field label="Email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
      <p style={{ marginTop: 16 }}><Link href="/login">Back to sign in</Link></p>
    </AuthCard>
  );
}
