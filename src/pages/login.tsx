import { useRouter } from "next/router";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/AuthCard";
import { Field } from "@/components/Field";
import { Banner } from "@/components/Banner";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";
import { useAuth } from "@/context/AuthContext";

const safeNext = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard");

export default function Login() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/api/auth/login", { body: { email, password } });
      await refresh();
      await router.push(safeNext(router.query.next));
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    try {
      const r = await apiFetch<{ message: string }>("/api/auth/resend-verification", { body: { email } });
      setNotice(r.message);
      setError(null);
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <AuthCard title="Sign in">
      <form onSubmit={submit} noValidate>
        {notice && <Banner tone="success">{notice}</Banner>}
        {error && (
          <Banner tone="error">
            {error.message}{" "}
            {error.code === "EMAIL_NOT_VERIFIED" && (
              <button type="button" className="btn btn-ghost" style={{ marginTop: 8 }} onClick={resend}>Send a new link</button>
            )}
          </Banner>
        )}
        <Field label="Email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <p style={{ marginTop: 16 }}><Link href="/forgot-password">Forgot your password?</Link></p>
      <p>New here? <Link href="/signup">Start a free trial</Link></p>
    </AuthCard>
  );
}
