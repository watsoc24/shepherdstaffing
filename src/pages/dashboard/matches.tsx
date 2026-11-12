import type { GetServerSideProps } from "next";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Banner } from "@/components/Banner";
import { requirePageAuth } from "@/lib/auth/ssr";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";

export const getServerSideProps: GetServerSideProps = (ctx) => requirePageAuth(ctx, ["candidate", "church"]);

type MatchRow = {
  id: string;
  score: number;
  status: string;
  modelVersion: string;
  other: { displayCode: string; position: string | null };
  breakdown?: Record<string, number>;
  strengths?: string[];
  gaps?: string[];
  recommendation?: string;
};

/** M5 matches page: your matches, best first, with the detail your plan allows. */
export default function Matches() {
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      const d = await apiFetch<{ matches: MatchRow[] }>("/api/matches");
      setRows(d.matches);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function refresh() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const d = await apiFetch<{ computed: number; skipped: number }>("/api/matches/refresh", { method: "POST" });
      setNotice(`${d.computed} match${d.computed === 1 ? "" : "es"} computed, ${d.skipped} unchanged.`);
      await load();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function dismiss(id: string) {
    setError(null);
    try {
      await apiFetch("/api/matches/dismiss", { method: "POST", body: { matchId: id } });
      setRows((r) => r.filter((m) => m.id !== id));
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <Layout title="Matches">
      <div className="container" style={{ padding: "32px 16px 64px" }}>
        <p className="label">AI matching</p>
        <h1>Your matches</h1>
        <p className="muted">
          Scores are a transparent rubric — theology, role, experience, geography, and PreQual — not a black box.
          The written note is AI-drafted from the public profiles.
        </p>
        {error && <Banner tone="error">{error.message}</Banner>}
        {notice && <Banner tone="success">{notice}</Banner>}
        <button className="btn btn-primary" disabled={busy} onClick={refresh}>
          {busy ? "Computing…" : "Refresh matches"}
        </button>
        {!loaded ? (
          <p style={{ marginTop: 16 }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted" style={{ marginTop: 16 }}>
            No matches yet. Finish your profile first — detail drives matching — then refresh.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
            {rows.map((m) => (
              <div className="card" key={m.id}>
                <p style={{ margin: 0 }}>
                  <strong>{m.score} / 100</strong> · {m.other.position ?? "Open role"} · {m.other.displayCode}
                </p>
                {m.breakdown && (
                  <p className="muted" style={{ margin: "8px 0" }}>
                    {Object.entries(m.breakdown)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </p>
                )}
                {m.strengths && (
                  <ul style={{ margin: "8px 0" }}>
                    {m.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
                {m.gaps && m.gaps.length > 0 && (
                  <p className="muted">Watch for: {m.gaps.join(" ")}</p>
                )}
                {m.recommendation && <p>{m.recommendation}</p>}
                <button className="btn btn-ghost" type="button" onClick={() => dismiss(m.id)}>
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
