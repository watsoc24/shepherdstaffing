import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Layout } from "@/components/Layout";
import { Field, TextArea } from "@/components/Field";
import { Banner } from "@/components/Banner";
import { requirePageAuth } from "@/lib/auth/ssr";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";
import type { CandidateProfile } from "@/lib/profiles";

export const getServerSideProps: GetServerSideProps = (ctx) => requirePageAuth(ctx, ["candidate"]);

type PreQualRow = { score: number; recommendation: string };

const EMPTY: CandidateProfile = {
  id: "", displayCode: "", name: "", position: "", theology: "", yearsExp: null,
  currentRole: "", geoPreference: "", relocation: "", salaryRange: "",
  philosophy: "", strengths: "", callingNotes: "", nonNegotiables: "",
  privateNotes: "", familyNotes: "", visibility: "public", verified: false, profileScore: 0,
};

/** M3 candidate profile: public section (shown in listings) + private section (encrypted, never in a listing). */
export default function CandidateProfilePage() {
  const [form, setForm] = useState<CandidateProfile>(EMPTY);
  const [prequal, setPrequal] = useState<PreQualRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ profile: CandidateProfile }>("/api/profiles/candidate")
      .then((d) => {
        if (!cancelled) setForm({ ...EMPTY, ...d.profile });
      })
      .catch((e) => {
        if (!cancelled) setError(e as ApiError);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    apiFetch<{ assessments: PreQualRow[] }>("/api/prequal/assessments")
      .then((d) => {
        if (!cancelled) setPrequal(d.assessments);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const set = <K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const d = await apiFetch<{ profile: CandidateProfile }>("/api/profiles/candidate", {
        method: "PUT",
        body: { ...form, id: undefined, displayCode: undefined, verified: undefined, profileScore: undefined },
      });
      setForm({ ...EMPTY, ...d.profile });
      setSaved(true);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <Layout title="Your profile">
        <div className="container" style={{ padding: "32px 16px 64px" }}>
          <p>Loading your profile…</p>
        </div>
      </Layout>
    );
  }

  const bestPrequal = prequal.length ? Math.max(...prequal.map((r) => r.score)) : null;

  return (
    <Layout title="Your profile">
      <div className="container" style={{ padding: "32px 16px 64px" }}>
        <p className="label">Candidate profile · M3</p>
        <h1>Your profile</h1>
        <p className="muted">
          Profile completeness: <strong>{form.profileScore} / 100</strong>
          {form.verified ? " · Verified" : " · Not verified yet"}
          {form.displayCode ? ` · Listing code ${form.displayCode}` : ""}
        </p>
        <p className="muted">
          PreQual screenings:{" "}
          {bestPrequal === null ? (
            <>
              none yet — <Link href="/prequal">take the 5-minute screening</Link>
            </>
          ) : (
            <>
              {prequal.length} completed, best score {bestPrequal} / 100 —{" "}
              <Link href="/dashboard/prequal">view them</Link>
            </>
          )}
        </p>
        {error && <Banner tone="error">{error.message}</Banner>}
        {saved && <Banner tone="success">Profile saved.</Banner>}
        <form onSubmit={submit} noValidate>
          <h2>Public — shown in listings</h2>
          <Field label="Full name" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          <Field label="Position you're seeking" value={form.position ?? ""} onChange={(e) => set("position", e.target.value)}
            hint="e.g. Lead Pastor, Worship Pastor, Children's Director" />
          <Field label="Theology" value={form.theology ?? ""} onChange={(e) => set("theology", e.target.value)}
            hint="A short line — your tradition and convictions in your own words" />
          <Field label="Years of experience" type="number" min={0} max={60}
            value={form.yearsExp === null ? "" : form.yearsExp}
            onChange={(e) => set("yearsExp", e.target.value === "" ? null : Number(e.target.value))} />
          <Field label="Current role" value={form.currentRole ?? ""} onChange={(e) => set("currentRole", e.target.value)} />
          <Field label="Where you want to serve" value={form.geoPreference ?? ""} onChange={(e) => set("geoPreference", e.target.value)} />
          <Field label="Willing to relocate?" value={form.relocation ?? ""} onChange={(e) => set("relocation", e.target.value)}
            hint="e.g. Yes, within the Midwest — or No" />
          <Field label="Salary range" value={form.salaryRange ?? ""} onChange={(e) => set("salaryRange", e.target.value)} />
          <TextArea label="Ministry philosophy" rows={4} value={form.philosophy ?? ""} onChange={(e) => set("philosophy", e.target.value)} />
          <TextArea label="Strengths" rows={3} value={form.strengths ?? ""} onChange={(e) => set("strengths", e.target.value)} />

          <h2>Private — encrypted, never in a listing</h2>
          <p className="muted">
            These are stored encrypted and shown only where the role allows. They are never sent to AI and never
            appear in a public listing.
          </p>
          <TextArea label="Calling notes" rows={3} value={form.callingNotes ?? ""} onChange={(e) => set("callingNotes", e.target.value)}
            hint="What you believe God is calling you to — for matched churches and recruiters" />
          <TextArea label="Non-negotiables" rows={3} value={form.nonNegotiables ?? ""} onChange={(e) => set("nonNegotiables", e.target.value)}
            hint="What you cannot compromise on in a next role" />
          <TextArea label="Private notes" rows={3} value={form.privateNotes ?? ""} onChange={(e) => set("privateNotes", e.target.value)}
            hint="Anything a matched church should know that doesn't belong in a listing" />
          <TextArea label="Family notes" rows={3} value={form.familyNotes ?? ""} onChange={(e) => set("familyNotes", e.target.value)}
            hint="Recruiter-only. Never sent to AI or to other users." />

          <div className="field">
            <label htmlFor="candidate-visibility">Listing visibility</label>
            <select id="candidate-visibility" value={form.visibility}
              onChange={(e) => set("visibility", e.target.value as CandidateProfile["visibility"])}>
              <option value="public">Public — appear in listings</option>
              <option value="hidden">Hidden — only matched churches see you</option>
            </select>
          </div>

          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
        </form>
      </div>
    </Layout>
  );
}
