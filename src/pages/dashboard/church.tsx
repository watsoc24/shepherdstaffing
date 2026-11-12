import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Layout } from "@/components/Layout";
import { Field, TextArea } from "@/components/Field";
import { Banner } from "@/components/Banner";
import { requirePageAuth } from "@/lib/auth/ssr";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";
import type { ChurchProfile } from "@/lib/profiles";

export const getServerSideProps: GetServerSideProps = (ctx) => requirePageAuth(ctx, ["church"]);

const EMPTY: ChurchProfile = {
  id: "", displayCode: "", name: "", city: "", region: "", denomination: "",
  theology: "", size: "", stage: "", position: "", salaryRange: "", timeline: "",
  culture: "", mustHave: "", niceToHave: "", whyHere: "", dealBreakers: "",
  visibility: "public", profileScore: 0,
};

/** M3 church profile: public section (shown in listings) + private deal-breakers (encrypted). */
export default function ChurchProfilePage() {
  const [form, setForm] = useState<ChurchProfile>(EMPTY);
  const [assessmentCount, setAssessmentCount] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ profile: ChurchProfile }>("/api/profiles/church")
      .then((d) => {
        if (!cancelled) setForm({ ...EMPTY, ...d.profile });
      })
      .catch((e) => {
        if (!cancelled) setError(e as ApiError);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    apiFetch<{ assessments: unknown[] }>("/api/prequal/assessments")
      .then((d) => {
        if (!cancelled) setAssessmentCount(d.assessments.length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const set = <K extends keyof ChurchProfile>(key: K, value: ChurchProfile[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const d = await apiFetch<{ profile: ChurchProfile }>("/api/profiles/church", {
        method: "PUT",
        body: { ...form, id: undefined, displayCode: undefined, profileScore: undefined },
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

  return (
    <Layout title="Your profile">
      <div className="container" style={{ padding: "32px 16px 64px" }}>
        <p className="label">Church profile · M3</p>
        <h1>Your church profile</h1>
        <p className="muted">
          Profile completeness: <strong>{form.profileScore} / 100</strong>
          {form.displayCode ? ` · Listing code ${form.displayCode}` : ""}
        </p>
        {assessmentCount !== null && (
          <p className="muted">
            {assessmentCount === 0 ? (
              <>
                No PreQual assessments yet. Share <Link href="/prequal">/prequal</Link> with applicants for your open
                role.
              </>
            ) : (
              <>
                {assessmentCount} PreQual assessment{assessmentCount === 1 ? "" : "s"} from applicants —{" "}
                <Link href="/dashboard/prequal">review them</Link>
              </>
            )}
          </p>
        )}
        {error && <Banner tone="error">{error.message}</Banner>}
        {saved && <Banner tone="success">Profile saved.</Banner>}
        <form onSubmit={submit} noValidate>
          <h2>Public — shown in listings</h2>
          <Field label="Church name" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          <Field label="City" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          <Field label="Region" value={form.region ?? ""} onChange={(e) => set("region", e.target.value)}
            hint="The region shown in anonymized listings, e.g. Cincinnati metro" />
          <Field label="Denomination" value={form.denomination ?? ""} onChange={(e) => set("denomination", e.target.value)} />
          <Field label="Theology" value={form.theology ?? ""} onChange={(e) => set("theology", e.target.value)}
            hint="A short line — your tradition and convictions in your own words" />
          <Field label="Congregation size" value={form.size ?? ""} onChange={(e) => set("size", e.target.value)}
            hint="e.g. ~120 on a Sunday" />
          <Field label="Church stage" value={form.stage ?? ""} onChange={(e) => set("stage", e.target.value)}
            hint="e.g. Plant, growing, established, transitioning" />
          <Field label="Position you're hiring" value={form.position ?? ""} onChange={(e) => set("position", e.target.value)} />
          <Field label="Salary range" value={form.salaryRange ?? ""} onChange={(e) => set("salaryRange", e.target.value)} />
          <Field label="Timeline" value={form.timeline ?? ""} onChange={(e) => set("timeline", e.target.value)}
            hint="e.g. Hoping to hire by spring" />
          <TextArea label="Culture" rows={4} value={form.culture ?? ""} onChange={(e) => set("culture", e.target.value)}
            hint="What it feels like to be part of this church" />
          <TextArea label="Must-haves" rows={3} value={form.mustHave ?? ""} onChange={(e) => set("mustHave", e.target.value)} />
          <TextArea label="Nice to have" rows={3} value={form.niceToHave ?? ""} onChange={(e) => set("niceToHave", e.target.value)} />
          <TextArea label="Why serve here?" rows={3} value={form.whyHere ?? ""} onChange={(e) => set("whyHere", e.target.value)} />

          <h2>Private — encrypted, never in a listing</h2>
          <TextArea label="Deal-breakers" rows={3} value={form.dealBreakers ?? ""} onChange={(e) => set("dealBreakers", e.target.value)}
            hint="Stored encrypted. Shown only where the role allows — never in a public listing." />

          <div className="field">
            <label htmlFor="church-visibility">Listing visibility</label>
            <select id="church-visibility" value={form.visibility}
              onChange={(e) => set("visibility", e.target.value as ChurchProfile["visibility"])}>
              <option value="public">Public — appear in listings</option>
              <option value="hidden">Hidden — only matched candidates see you</option>
            </select>
          </div>

          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
        </form>
      </div>
    </Layout>
  );
}
