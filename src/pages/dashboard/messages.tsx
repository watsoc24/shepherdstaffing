import type { GetServerSideProps } from "next";
import { useEffect, useState, type FormEvent } from "react";
import { Layout } from "@/components/Layout";
import { Banner } from "@/components/Banner";
import { requirePageAuth } from "@/lib/auth/ssr";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";

export const getServerSideProps: GetServerSideProps = (ctx) => requirePageAuth(ctx, ["candidate", "church"]);

type ThreadRow = {
  id: string;
  status: string;
  contactSharedAt: string | null;
  updatedAt: string;
  initiatedByMe: boolean;
  unread: number;
  other: { displayCode: string; position: string | null };
};

type ThreadDetail = {
  id: string;
  status: string;
  contactSharedAt: string | null;
  initiatedByMe: boolean;
  party: string;
  other: { displayCode: string; position: string | null };
  messages: { id: string; body: string; createdAt: string; mine: boolean }[];
};

/** M6 messages page: your conversations, with accept/decline, block, and report. */
export default function Messages() {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [reply, setReply] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadList() {
    try {
      const d = await apiFetch<{ threads: ThreadRow[] }>("/api/threads");
      setThreads(d.threads);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  async function open(id: string) {
    setError(null);
    try {
      const d = await apiFetch<ThreadDetail>(`/api/threads/detail?threadId=${encodeURIComponent(id)}`);
      setDetail(d);
      setReply("");
      setShowReport(false);
      await loadList(); // unread counts clear after reading
    } catch (err) {
      setError(err as ApiError);
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!detail || !reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/threads/messages", { method: "POST", body: { threadId: detail.id, body: reply } });
      setReply("");
      await open(detail.id);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function respond(accept: boolean) {
    if (!detail) return;
    setError(null);
    try {
      await apiFetch(`/api/threads/${accept ? "accept" : "decline"}`, { method: "POST", body: { threadId: detail.id } });
      setNotice(accept ? "Request accepted — you can both write now." : "Request declined.");
      await open(detail.id);
      await loadList();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  async function block() {
    if (!detail || !window.confirm("Block this person and close the conversation?")) return;
    setError(null);
    try {
      await apiFetch("/api/threads/block", { method: "POST", body: { threadId: detail.id } });
      setDetail(null);
      await loadList();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  async function report(e: FormEvent) {
    e.preventDefault();
    if (!detail || !reportReason.trim()) return;
    setError(null);
    try {
      await apiFetch("/api/threads/report", { method: "POST", body: { threadId: detail.id, reason: reportReason } });
      setNotice("Reported. Our team will review it.");
      setReportReason("");
      setShowReport(false);
    } catch (err) {
      setError(err as ApiError);
    }
  }

  const canReply = detail?.status === "accepted";
  const awaitingMe = detail?.status === "requested" && !detail.initiatedByMe;

  return (
    <Layout title="Messages">
      <div className="container" style={{ padding: "32px 16px 64px" }}>
        <p className="label">Messages</p>
        <h1>Your conversations</h1>
        <p className="muted">
          Contact starts as a request. Once the other side accepts, you can both write freely — and contact
          details are shared then, not before.
        </p>
        {error && <Banner tone="error">{error.message}</Banner>}
        {notice && <Banner tone="success">{notice}</Banner>}
        {!loaded ? (
          <p>Loading…</p>
        ) : threads.length === 0 ? (
          <p className="muted">No conversations yet. Contact a match from your matches page — membership required.</p>
        ) : (
          <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <div>
              {threads.map((t) => (
                <button key={t.id} type="button" className="card" style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 12 }}
                  onClick={() => open(t.id)}>
                  <strong>{t.other.position ?? "Open role"}</strong> · {t.other.displayCode}
                  <br />
                  <span className="muted">
                    {t.status}
                    {t.unread > 0 ? ` · ${t.unread} unread` : ""}
                  </span>
                </button>
              ))}
            </div>
            <div>
              {detail ? (
                <>
                  <h2 style={{ marginTop: 0 }}>
                    {detail.other.position ?? "Open role"} · {detail.other.displayCode}
                  </h2>
                  <p className="muted">
                    Status: {detail.status}
                    {detail.contactSharedAt ? " · Contact details shared" : ""}
                  </p>
                  {awaitingMe && (
                    <div style={{ display: "flex", gap: 12, margin: "12px 0" }}>
                      <button className="btn btn-primary" type="button" onClick={() => respond(true)}>Accept request</button>
                      <button className="btn btn-ghost" type="button" onClick={() => respond(false)}>Decline</button>
                    </div>
                  )}
                  <div style={{ display: "grid", gap: 12, margin: "16px 0" }}>
                    {detail.messages.map((m) => (
                      <div key={m.id} className="card" style={{ background: m.mine ? "#f4efe7" : undefined }}>
                        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.body}</p>
                      </div>
                    ))}
                  </div>
                  {canReply && (
                    <form onSubmit={send}>
                      <div className="field">
                        <label htmlFor="reply">Your message</label>
                        <textarea id="reply" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
                      </div>
                      <button className="btn btn-primary" disabled={busy || !reply.trim()}>
                        {busy ? "Sending…" : "Send"}
                      </button>
                    </form>
                  )}
                  {!canReply && detail.status === "requested" && detail.initiatedByMe && (
                    <p className="muted">Request sent — waiting for the other side to accept.</p>
                  )}
                  <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                    <button className="btn btn-ghost" type="button" onClick={block}>Block</button>
                    <button className="btn btn-ghost" type="button" onClick={() => setShowReport((v) => !v)}>
                      {showReport ? "Cancel report" : "Report"}
                    </button>
                  </div>
                  {showReport && (
                    <form onSubmit={report} style={{ marginTop: 12 }}>
                      <div className="field">
                        <label htmlFor="report-reason">What happened?</label>
                        <textarea id="report-reason" rows={3} value={reportReason} onChange={(e) => setReportReason(e.target.value)} />
                      </div>
                      <button className="btn btn-primary" disabled={!reportReason.trim()}>Submit report</button>
                    </form>
                  )}
                </>
              ) : (
                <p className="muted">Choose a conversation to read it.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
