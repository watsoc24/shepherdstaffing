import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Banner } from "@/components/Banner";
import { requirePageAuth } from "@/lib/auth/ssr";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";
import { RECOMMENDATION_LABEL, type PreQualRecommendation } from "@/lib/scoring/prequal";
import type { ClientEntitlements, SessionUser } from "@/context/AuthContext";

export const getServerSideProps: GetServerSideProps = (ctx) => requirePageAuth(ctx, ["church", "candidate"]);

type Assessment = {
  id: string;
  applicantName: string;
  applicantEmail: string;
  role: string;
  score: number;
  breakdown: Record<string, number>;
  recommendation: PreQualRecommendation;
  knockoutFailed: boolean;
  flags: string[];
  createdAt: string;
};

function exportCsv(rows: Assessment[]) {
  const head = "Name,Email,Role,Score,Recommendation,Flags,Submitted\n";
  const body = rows
    .map((r) =>
      [r.applicantName, r.applicantEmail, r.role, r.score, r.recommendation, r.flags.join("; "), r.createdAt.slice(0, 10)]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([head + body], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "prequal-assessments.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function PreQualDashboard({ user }: { user: SessionUser; entitlements: ClientEntitlements }) {
  const [rows, setRows] = useState<Assessment[]>([]);
  const [filter, setFilter] = useState<"all" | PreQualRecommendation>("all");
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ assessments: Assessment[] }>("/api/prequal/assessments")
      .then((d) => {
        if (!cancelled) setRows(d.assessments);
      })
      .catch((e) => {
        if (!cancelled) setError(e as ApiError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = rows.filter((r) => filter === "all" || r.recommendation === filter);
  const isChurch = user.role === "church";

  return (
    <Layout title="PreQual assessments">
      <div className="container" style={{ padding: "32px 16px 64px" }}>
        <p className="label">PreQual screening</p>
        <h1>{isChurch ? "PreQual assessments for your church" : "Your PreQual assessments"}</h1>
        <p className="muted">
          {isChurch
            ? "Applicants who completed the PreQual screening for your church, best first. Only assessments submitted for your church are shown."
            : "Your completed PreQual screenings, newest first."}
        </p>
        {error && <Banner tone="error">{error.message}</Banner>}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", margin: "16px 0" }}>
          <label>
            Filter:{" "}
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">All</option>
              <option value="advance">Advance</option>
              <option value="review">Review</option>
              <option value="not_advancing">Not advancing</option>
            </select>
          </label>
          <button className="btn btn-ghost" type="button" onClick={() => exportCsv(shown)} disabled={shown.length === 0}>
            Export CSV
          </button>
          {!isChurch && (
            <Link className="btn btn-primary" href="/prequal">
              Take the PreQual screening
            </Link>
          )}
        </div>

        {loading ? (
          <p>Loading…</p>
        ) : shown.length === 0 ? (
          <p className="muted">
            {isChurch ? (
              <>
                No assessments yet. Share <Link href="/prequal">/prequal</Link> with applicants for your open roles.
              </>
            ) : (
              <>
                You haven&apos;t completed a PreQual screening yet. <Link href="/prequal">Take it here</Link> — about 5
                minutes.
              </>
            )}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Role</th>
                  <th>Score</th>
                  <th>Recommendation</th>
                  <th>Flags</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.applicantName}
                      <br />
                      <span className="muted">{r.applicantEmail}</span>
                    </td>
                    <td>{r.role}</td>
                    <td>
                      <strong>{r.score}</strong> / 100
                    </td>
                    <td>{RECOMMENDATION_LABEL[r.recommendation]}</td>
                    <td>{r.flags.join(" · ")}</td>
                    <td>{r.createdAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
