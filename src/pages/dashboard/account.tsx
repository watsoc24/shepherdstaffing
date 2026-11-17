import type { GetServerSideProps } from "next";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Layout } from "@/components/Layout";
import { Banner } from "@/components/Banner";
import { requirePageAuth } from "@/lib/auth/ssr";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";
import type { ClientEntitlements, SessionUser } from "@/context/AuthContext";

export const getServerSideProps: GetServerSideProps = (ctx) => requirePageAuth(ctx);

type ConsentRow = { type: string; version: string; acceptedAt: string };

/** M9 account page: password, your consents, your data (export), and closing your account. */
export default function Account({ user, entitlements }: { user: SessionUser; entitlements: ClientEntitlements }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [consents, setConsents] = useState<ConsentRow[]>([]);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ consents: ConsentRow[] }>("/api/account/consents")
      .then((d) => setConsents(d.consents))
      .catch(() => undefined);
  }, []);

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
      setNotice("Password changed. Your other sessions were signed out.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function downloadExport() {
    setError(null);
    try {
      const res = await fetch("/api/account/export", { method: "POST", credentials: "same-origin" });
      if (!res.ok) throw new Error("Export failed. Please try again.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fit-for-ministry-export.json";
      a.click();
      URL.revokeObjectURL(url);
      setNotice("Export downloaded.");
    } catch (err) {
      setError(err as ApiError);
    }
  }

  async function deleteAccount(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/account/delete", { method: "POST", body: { confirm: confirmDelete } });
      window.location.href = "/login";
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Layout title="Account">
      <div className="container" style={{ padding: "32px 16px 64px", maxWidth: 640 }}>
        <p className="label">Account</p>
        <h1>Your account</h1>
        <p className="muted">
          {user.name} · {user.email} · {user.role} · {entitlements.state}
        </p>
        {error && <Banner tone="error">{error.message}</Banner>}
        {notice && <Banner tone="success">{notice}</Banner>}

        <h2>Password</h2>
        <form onSubmit={changePassword}>
          <div className="field">
            <label htmlFor="currentPassword">Current password</label>
            <input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Changing…" : "Change password"}</button>
        </form>
        <p className="muted">
          Billing lives on its own page: <Link href="/dashboard/billing">Membership, card, cancel</Link>.
        </p>

        <h2>What you agreed to</h2>
        {consents.length === 0 ? (
          <p className="muted">No consents recorded yet.</p>
        ) : (
          consents.map((c) => (
            <p key={c.type} className="muted" style={{ margin: "4px 0" }}>
              {c.type} — version {c.version} · {c.acceptedAt.slice(0, 10)}
            </p>
          ))
        )}
        <p className="muted">
          <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
        </p>

        <h2>Your data</h2>
        <p className="muted">
          Download everything we hold about you — profile, screening, matches, messages, interview, subscription,
          and consents — as one JSON file.
        </p>
        <button className="btn btn-primary" type="button" onClick={downloadExport}>Download my data</button>

        <h2>Close your account</h2>
        <p className="muted">
          Closing your account signs you out everywhere and marks your data for deletion; personal data is purged
          within 30 days. If you have an active membership, cancel it first in Billing — we won&apos;t take money
          from an account that no longer exists.
        </p>
        <form onSubmit={deleteAccount}>
          <div className="field">
            <label htmlFor="confirmDelete">Type DELETE to confirm</label>
            <input id="confirmDelete" value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} />
          </div>
          <button className="btn btn-ghost" disabled={confirmDelete !== "DELETE"}>Delete my account</button>
        </form>
      </div>
    </Layout>
  );
}
