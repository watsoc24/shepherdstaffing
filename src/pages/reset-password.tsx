import { useRouter } from "next/router";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/AuthCard";
import { Field } from "@/components/Field";
import { Banner } from "@/components/Banner";
import { apiFetch, fieldError, type ApiError } from "@/lib/client/apiFetch";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const token = typeof router.query.token === "string" ? router.query.token : "";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError({ code: "BAD_REQUEST", message: "Passwords don't match.", details: [{ path: "confirm", message: "Passwords don't match" }] });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/auth/reset-password", { body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthCard title="Password updated">
        <Banner tone="success">Your password has been changed and you&apos;ve been signed out everywhere.</Banner>
        <Link className="btn btn-primary btn-block" href="/login">Sign in</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      {router.isReady && !token && <Banner tone="error">This link is missing its token. Please use the link from your email.</Banner>}
      <form onSubmit={submit} noValidate>
        {error && !error.details && <Banner tone="error">{error.message}</Banner>}
        <Field label="New password" type="password" autoComplete="new-password" required minLength={10}
          hint="At least 10 characters." value={password} onChange={(e) => setPassword(e.target.value)} error={fieldError(error, "password")} />
        <Field label="Confirm new password" type="password" autoComplete="new-password" required
          value={confirm} onChange={(e) => setConfirm(e.target.value)} error={fieldError(error, "confirm")} />
        <button className="btn btn-primary btn-block" disabled={busy || !token}>{busy ? "Saving…" : "Update password"}</button>
      </form>
    </AuthCard>
  );
}
