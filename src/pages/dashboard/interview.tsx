import type { GetServerSideProps } from "next";
import { useEffect, useState, type FormEvent } from "react";
import { Layout } from "@/components/Layout";
import { Banner } from "@/components/Banner";
import { requirePageAuth } from "@/lib/auth/ssr";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";
import { INTERVIEW_CONSENT_TEXT, INTERVIEW_QUESTIONS } from "@/lib/interview/questions";

export const getServerSideProps: GetServerSideProps = (ctx) => requirePageAuth(ctx, ["candidate"]);

type OwnInterview = {
  id: string;
  status: string;
  consentTextVersion: string | null;
  answers: Record<string, string>;
  submittedAt: string | null;
  score: number | null;
  retakeAllowed: boolean;
  shareWithChurchIds: string[];
};

type ShareTarget = { id: string; displayCode: string; position: string | null; shared: boolean };

/** M7 candidate interview: six written questions, encrypted answers, candidate-controlled sharing. */
export default function Interview() {
  const [interview, setInterview] = useState<OwnInterview | null>(null);
  const [targets, setTargets] = useState<ShareTarget[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [shared, setShared] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const d = await apiFetch<{ interview: OwnInterview | null; shareTargets: ShareTarget[] }>("/api/interviews");
      setInterview(d.interview);
      setTargets(d.shareTargets);
      setAnswers(d.interview?.answers ?? {});
      setShared(d.interview?.shareWithChurchIds ?? []);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function start() {
    setError(null);
    try {
      const d = await apiFetch<{ interviewId: string }>("/api/interviews/start", { method: "POST", body: {} });
      setNotice("Interview started. Your answers are saved as a draft until you submit.");
      await load();
      return d.interviewId;
    } catch (err) {
      setError(err as ApiError);
      return null;
    }
  }

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (!interview) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/interviews/answers", { method: "POST", body: { interviewId: interview.id, answers } });
      setNotice("Draft saved.");
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!interview) return;
    setError(null);
    try {
      await apiFetch("/api/interviews/submit", { method: "POST", body: { interviewId: interview.id } });
      setNotice("Submitted. A recruiter will evaluate it, and you choose who sees the result.");
      await load();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  async function toggleShare(churchId: string) {
    if (!interview) return;
    const next = shared.includes(churchId) ? shared.filter((id) => id !== churchId) : [...shared, churchId];
    setShared(next);
    setError(null);
    try {
      await apiFetch("/api/interviews/share", { method: "POST", body: { interviewId: interview.id, churchIds: next } });
    } catch (err) {
      setError(err as ApiError);
      setShared(shared);
    }
  }

  const isDraft = interview?.status === "draft";

  return (
    <Layout title="Interview">
      <div className="container" style={{ padding: "32px 16px 64px" }}>
        <p className="label">Interview</p>
        <h1>The structured interview</h1>
        <p className="muted">
          Six written questions, answered in your own time. Your answers are encrypted and stay between you and
          Shepherd Staffing — churches see only the evaluation, and only the ones you choose.
        </p>
        {error && <Banner tone="error">{error.message}</Banner>}
        {notice && <Banner tone="success">{notice}</Banner>}
        {!loaded ? (
          <p>Loading…</p>
        ) : !interview ? (
          <div className="card">
            <p>{INTERVIEW_CONSENT_TEXT}</p>
            <button className="btn btn-primary" type="button" onClick={start}>Start the interview</button>
          </div>
        ) : (
          <>
            <p className="muted">
              Status: {interview.status}
              {interview.score !== null ? ` · Evaluation score: ${interview.score} / 100` : ""}
              {interview.submittedAt ? ` · Submitted ${interview.submittedAt.slice(0, 10)}` : ""}
            </p>
            <form onSubmit={save}>
              {INTERVIEW_QUESTIONS.map((q) => (
                <div className="field" key={q.id}>
                  <label htmlFor={q.id}>{q.prompt}</label>
                  <p className="muted" style={{ margin: "4px 0" }}>{q.hint}</p>
                  <textarea
                    id={q.id}
                    rows={5}
                    value={answers[q.id] ?? ""}
                    disabled={!isDraft}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  />
                </div>
              ))}
              {isDraft && (
                <div style={{ display: "flex", gap: 12 }}>
                  <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save draft"}</button>
                  <button className="btn btn-ghost" type="button" onClick={submit}>Submit interview</button>
                </div>
              )}
            </form>
            {interview.status !== "draft" && (
              <>
                <h2>Who sees the evaluation</h2>
                {targets.length === 0 ? (
                  <p className="muted">No matched churches yet — share once you have a match.</p>
                ) : (
                  targets.map((t) => (
                    <label key={t.id} className="card" style={{ display: "block", marginBottom: 12 }}>
                      <input type="checkbox" checked={shared.includes(t.id)} onChange={() => toggleShare(t.id)} />{" "}
                      {t.position ?? "Open role"} · {t.displayCode}
                    </label>
                  ))
                )}
                {interview.retakeAllowed && (
                  <button className="btn btn-primary" type="button" onClick={start}>Start a retake</button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
