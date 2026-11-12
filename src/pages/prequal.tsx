import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Layout } from "@/components/Layout";
import { Field } from "@/components/Field";
import { Banner } from "@/components/Banner";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";
import {
  PREQUAL_ALL_QUESTIONS,
  PREQUAL_ROLES,
  PREQUAL_WEIGHTS,
  RECOMMENDATION_LABEL,
  type PreQualResult,
} from "@/lib/scoring/prequal";

type SubmitResponse = PreQualResult & { ok: boolean; assessmentId: string };

const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Must-haves", ids: ["authorized", "schedule", "background"] },
  { title: "Experience", ids: ["exp_years", "exp_example"] },
  { title: "Availability", ids: ["avail_start", "avail_hours"] },
  { title: "Practical skills", ids: ["skill_tools", "skill_learn"] },
  { title: "Mission & values", ids: ["mission_why", "mission_team"] },
  { title: "Communication", ids: ["comm_example", "reliability"] },
];

/** Public PreQual screening — the free lead magnet. Scores are computed server-side. */
export default function PreQual() {
  const [form, setForm] = useState({ name: "", email: "", role: PREQUAL_ROLES[0] });
  // Keyed by option label as well as value: two options can share a value
  // (e.g. background check: "Yes" and "Not applicable" are both 1).
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const numeric: Record<string, number> = {};
      for (const [id, key] of Object.entries(answers)) numeric[id] = Number(key.split("|")[0]);
      const r = await apiFetch<SubmitResponse>("/api/prequal/submit", {
        body: { ...form, answers: numeric },
      });
      setResult(r);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Layout title="PreQual result">
        <section className="container" style={{ padding: "48px 0" }}>
          <p className="label">PreQual screening · {form.role}</p>
          <h1>
            {result.score} / 100 — {RECOMMENDATION_LABEL[result.recommendation]}
          </h1>
          <p>
            {result.recommendation === "advance"
              ? "Advance to interview — this looks like a strong fit on the screening questions."
              : result.recommendation === "review"
                ? "Review — worth a closer look from the hiring team."
                : "Not advancing on this screening — usually because of a must-have answer or a low overall score."}
          </p>
          <ul>
            {(Object.keys(PREQUAL_WEIGHTS) as (keyof typeof PREQUAL_WEIGHTS)[]).map((k) => (
              <li key={k}>
                {k}: {result.breakdown[k]} / {PREQUAL_WEIGHTS[k]}
              </li>
            ))}
          </ul>
          <p className="muted">Flags: {result.flags.join(" · ")}</p>
          <p className="muted">
            This is a screening summary, not a hiring decision. {form.name}, the hiring team reviews every result.
            To apply properly, <Link href="/signup?role=candidate">create a candidate account</Link>.
          </p>
          <button className="btn btn-ghost" type="button" onClick={() => setResult(null)}>
            Start a new prequalification
          </button>
        </section>
      </Layout>
    );
  }

  return (
    <Layout title="PreQual screening">
      <section className="container" style={{ padding: "48px 0" }}>
        <p className="label">PreQual screening · by Shepherd Staffing</p>
        <h1>Prequalify in about 5 minutes.</h1>
        <p style={{ maxWidth: 560 }}>
          Answer honestly — there are no trick questions. Your answers are scored the same way for every
          applicant, and the hiring team sees a 0–100 score with a clear Advance / Review / Not advancing
          recommendation.
        </p>
        {error && <Banner tone="error">{error.message}</Banner>}
        <form onSubmit={submit} noValidate>
          <Field
            label="Full name"
            autoComplete="name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <div className="field">
            <label htmlFor="prequal-role">Role you are applying for</label>
            <select
              id="prequal-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {PREQUAL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {GROUPS.map((g) => (
            <fieldset key={g.title} style={{ margin: "28px 0", border: "1px solid var(--border, #e5e0d8)", borderRadius: 12, padding: 16 }}>
              <legend style={{ fontWeight: 700 }}>{g.title}</legend>
              {g.ids.map((id) => {
                const q = PREQUAL_ALL_QUESTIONS.find((x) => x.id === id);
                if (!q) return null;
                return (
                  <div key={id} style={{ margin: "16px 0" }}>
                    <p style={{ fontWeight: 600, margin: "0 0 8px" }}>{q.label}</p>
                    {q.options.map((o) => {
                      const key = `${o.value}|${o.label}`;
                      return (
                        <label key={`${id}-${key}`} style={{ display: "block", padding: "6px 0" }}>
                          <input
                            type="radio"
                            name={id}
                            checked={answers[id] === key}
                            onChange={() => setAnswers({ ...answers, [id]: key })}
                          />{" "}
                          {o.label}
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </fieldset>
          ))}

          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Scoring…" : "See my result →"}
          </button>
          <p className="muted" style={{ marginTop: 12 }}>
            Demo note: screening questions have not had legal review — review them for your jurisdiction and role
            before live use.
          </p>
        </form>
      </section>
    </Layout>
  );
}
