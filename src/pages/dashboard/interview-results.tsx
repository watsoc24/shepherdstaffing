import type { GetServerSideProps } from "next";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Banner } from "@/components/Banner";
import { requirePageAuth } from "@/lib/auth/ssr";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";

export const getServerSideProps: GetServerSideProps = (ctx) => requirePageAuth(ctx, ["church"]);

type SharedRow = {
  id: string;
  candidate: { displayCode: string; position: string | null };
  score: number | null;
  submittedAt: string | null;
  recruiterNotes: string | null;
};

type ResultDetail = SharedRow & {
  evaluation: { scores: Record<string, number>; notes: Record<string, string>; questions: { id: string; prompt: string }[] } | null;
};

/** M7 church view: evaluated interviews shared with this church. Scores and evaluations — never the candidate's raw answers. */
export default function InterviewResults() {
  const [rows, setRows] = useState<SharedRow[]>([]);
  const [detail, setDetail] = useState<ResultDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiFetch<{ interviews: SharedRow[] }>("/api/interviews/shared")
      .then((d) => setRows(d.interviews))
      .catch((err) => setError(err as ApiError))
      .finally(() => setLoaded(true));
  }, []);

  async function open(id: string) {
    setError(null);
    try {
      const d = await apiFetch<ResultDetail>(`/api/interviews/results?interviewId=${encodeURIComponent(id)}`);
      setDetail(d);
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Layout title="Interview results">
      <div className="container" style={{ padding: "32px 16px 64px" }}>
        <p className="label">Interview results</p>
        <h1>Interviews shared with you</h1>
        <p className="muted">
          Candidates choose who sees their evaluation. You see the recruiter&apos;s score and notes — not the
          candidate&apos;s raw answers. Viewing results requires a membership.
        </p>
        {error && <Banner tone="error">{error.message}</Banner>}
        {!loaded ? (
          <p>Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted">No evaluated interviews have been shared with you yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <div>
              {rows.map((r) => (
                <button key={r.id} type="button" className="card" style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 12 }}
                  onClick={() => open(r.id)}>
                  <strong>{r.score ?? "—"} / 100</strong> · {r.candidate.position ?? "Open role"} · {r.candidate.displayCode}
                  <br />
                  <span className="muted">{r.submittedAt ? `Submitted ${r.submittedAt.slice(0, 10)}` : ""}</span>
                </button>
              ))}
            </div>
            <div>
              {detail ? (
                <>
                  <h2 style={{ marginTop: 0 }}>
                    {detail.score ?? "—"} / 100 · {detail.candidate.position ?? "Open role"} · {detail.candidate.displayCode}
                  </h2>
                  {detail.recruiterNotes && <p>{detail.recruiterNotes}</p>}
                  {detail.evaluation?.questions.map((q) => (
                    <div key={q.id} className="card" style={{ marginBottom: 12 }}>
                      <p style={{ margin: "0 0 8px" }}><strong>{detail.evaluation?.scores[q.id] ?? "—"} / 4</strong> — {q.prompt}</p>
                      {detail.evaluation?.notes[q.id] && <p className="muted" style={{ margin: 0 }}>{detail.evaluation.notes[q.id]}</p>}
                    </div>
                  ))}
                </>
              ) : (
                <p className="muted">Choose an interview to read the evaluation.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
