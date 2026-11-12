import type { GetServerSideProps } from "next";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Banner } from "@/components/Banner";
import { requirePageAuth } from "@/lib/auth/ssr";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";

export const getServerSideProps: GetServerSideProps = (ctx) => requirePageAuth(ctx, ["admin"]);

type InquiryRow = { id: string; contactName: string; contactEmail: string; churchName: string; tier: string; role: string | null; status: string; createdAt: string };
type ReportRow = { id: string; reporterUserId: string; reportedUserId: string; reason: string; status: string; createdAt: string };
type UserRow = { id: string; email: string; name: string; role: string; emailVerified: boolean; subscriptionStatus: string; trialEndDate: string | null; deactivatedAt: string | null };
type CandidateRow = { id: string; displayCode: string; name: string; position: string | null; verified: boolean; email: string; profileScore: number };
type AuditRow = { id: string; action: string; actorUserId: string | null; targetType: string | null; targetId: string | null; at: string };
type EngagementRow = { id: string; tier: string; stage: string; church: { displayCode: string } | null; inquiry: { churchName: string } | null };

/** M8 admin dashboard: intake queue, moderation, verification, accounts, and the audit trail. */
export default function Admin() {
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [engagements, setEngagements] = useState<EngagementRow[]>([]);
  const [privateView, setPrivateView] = useState<Record<string, string | null> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const [i, r, u, c, a, e] = await Promise.all([
        apiFetch<{ inquiries: InquiryRow[] }>("/api/admin/inquiries"),
        apiFetch<{ reports: ReportRow[] }>("/api/admin/reports"),
        apiFetch<{ users: UserRow[] }>("/api/admin/users"),
        apiFetch<{ candidates: CandidateRow[] }>("/api/admin/candidates"),
        apiFetch<{ audit: AuditRow[] }>("/api/admin/audit"),
        apiFetch<{ engagements: EngagementRow[] }>("/api/admin/engagements"),
      ]);
      setInquiries(i.inquiries);
      setReports(r.reports);
      setUsers(u.users);
      setCandidates(c.candidates);
      setAuditRows(a.audit);
      setEngagements(e.engagements);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(path: string, body: Record<string, unknown>, msg?: string) {
    setError(null);
    setNotice(null);
    try {
      await apiFetch(path, { method: "POST", body });
      if (msg) setNotice(msg);
      await load();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  async function viewPrivate(candidateId: string) {
    setError(null);
    try {
      const d = await apiFetch<Record<string, string | null>>("/api/admin/candidates/private", {
        method: "POST",
        body: { candidateId },
      });
      setPrivateView(d);
      setNotice("Private fields shown. This read was written to the audit log.");
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Layout title="Admin">
      <div className="container" style={{ padding: "32px 16px 64px" }}>
        <p className="label">Admin</p>
        <h1>Shepherd Staffing, behind the desk</h1>
        {error && <Banner tone="error">{error.message}</Banner>}
        {notice && <Banner tone="success">{notice}</Banner>}
        {!loaded ? (
          <p>Loading…</p>
        ) : (
          <>
            <h2>Inquiries ({inquiries.filter((i) => i.status === "new").length} new)</h2>
            {inquiries.length === 0 ? (
              <p className="muted">No inquiries yet. The public form is at /inquiry.</p>
            ) : (
              inquiries.map((i) => (
                <div key={i.id} className="card" style={{ marginBottom: 12 }}>
                  <strong>{i.churchName}</strong> · {i.tier} · {i.status} · {i.contactName} ({i.contactEmail})
                  {i.role ? <><br />Role: {i.role}</> : null}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {(["contacted", "scoped", "won", "lost"] as const).map((s) => (
                      <button key={s} className="btn btn-ghost" type="button" disabled={i.status === s}
                        onClick={() => act("/api/admin/inquiries/update", { inquiryId: i.id, status: s })}>
                        {s}
                      </button>
                    ))}
                    {i.status === "won" && (
                      <button className="btn btn-primary" type="button"
                        onClick={() => act("/api/admin/inquiries/convert", { inquiryId: i.id }, "Engagement created.")}>
                        Start engagement
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            <h2>Engagements ({engagements.length})</h2>
            {engagements.length === 0 ? (
              <p className="muted">No engagements yet — convert a won inquiry to start one.</p>
            ) : (
              engagements.map((e) => (
                <p key={e.id} className="card">{e.tier} · {e.stage} · {e.inquiry?.churchName ?? e.church?.displayCode ?? ""}</p>
              ))
            )}

            <h2>Reports ({reports.filter((r) => r.status === "open").length} open)</h2>
            {reports.length === 0 ? (
              <p className="muted">No reports.</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="card" style={{ marginBottom: 12 }}>
                  <p style={{ margin: 0 }}>{r.reason}</p>
                  <p className="muted" style={{ margin: "4px 0" }}>{r.status} · {r.createdAt.slice(0, 10)}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost" type="button" disabled={r.status === "reviewed"}
                      onClick={() => act("/api/admin/reports/resolve", { reportId: r.id, status: "reviewed" })}>Reviewed</button>
                    <button className="btn btn-ghost" type="button" disabled={r.status === "actioned"}
                      onClick={() => act("/api/admin/reports/resolve", { reportId: r.id, status: "actioned" })}>Actioned</button>
                  </div>
                </div>
              ))
            )}

            <h2>Candidates ({candidates.filter((c) => !c.verified).length} unverified)</h2>
            {candidates.map((c) => (
              <div key={c.id} className="card" style={{ marginBottom: 12 }}>
                <strong>{c.name}</strong> · {c.position ?? "Open role"} · {c.displayCode} · {c.verified ? "Verified" : "Not verified"} · score {c.profileScore}
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost" type="button"
                    onClick={() => act("/api/admin/verify-candidate", { candidateId: c.id, verified: !c.verified })}>
                    {c.verified ? "Unverify" : "Verify"}
                  </button>
                  <button className="btn btn-ghost" type="button" onClick={() => viewPrivate(c.id)}>View private fields</button>
                </div>
              </div>
            ))}
            {privateView && (
              <div className="card" style={{ marginBottom: 12 }}>
                <p><strong>Private fields for {privateView.name}</strong> (audited read)</p>
                <p>Calling notes: {privateView.callingNotes ?? "—"}</p>
                <p>Non-negotiables: {privateView.nonNegotiables ?? "—"}</p>
                <p>Private notes: {privateView.privateNotes ?? "—"}</p>
                <p>Family notes: {privateView.familyNotes ?? "—"}</p>
                <button className="btn btn-ghost" type="button" onClick={() => setPrivateView(null)}>Hide</button>
              </div>
            )}

            <h2>Accounts ({users.length})</h2>
            {users.map((u) => (
              <div key={u.id} className="card" style={{ marginBottom: 12 }}>
                <strong>{u.name}</strong> · {u.email} · {u.role} · {u.subscriptionStatus}
                {u.deactivatedAt ? " · Deactivated" : ""}
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost" type="button"
                    onClick={() => act("/api/admin/extend-trial", { userId: u.id, days: 7 }, "Trial extended 7 days.")}>
                    Extend trial 7d
                  </button>
                  <button className="btn btn-ghost" type="button"
                    onClick={() => { if (window.confirm(`Deactivate ${u.email}? Their sessions are revoked.`)) act("/api/admin/deactivate", { userId: u.id }); }}>
                    Deactivate
                  </button>
                  {u.role !== "admin" && (
                    <button className="btn btn-ghost" type="button"
                      onClick={() => { if (window.confirm(`Make ${u.email} an admin? Admins need MFA.`)) act("/api/admin/role", { userId: u.id, role: "admin" }); }}>
                      Make admin
                    </button>
                  )}
                </div>
              </div>
            ))}

            <h2>Audit trail (latest 100)</h2>
            {auditRows.length === 0 ? (
              <p className="muted">Nothing logged yet.</p>
            ) : (
              auditRows.slice(0, 20).map((a) => (
                <p key={a.id} className="muted" style={{ margin: "4px 0" }}>
                  {a.at.slice(0, 19).replace("T", " ")} · {a.action}
                  {a.targetType ? ` · ${a.targetType}:${a.targetId?.slice(0, 8)}` : ""}
                </p>
              ))
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
