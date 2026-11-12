import { useState, type FormEvent } from "react";
import { Layout } from "@/components/Layout";
import { Banner } from "@/components/Banner";
import { apiFetch, type ApiError } from "@/lib/client/apiFetch";

/** M8 public intake: a church asks Shepherd Staffing to run the search for them — assisted or full service. */
export default function Inquiry() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    contactName: "",
    contactEmail: "",
    churchName: "",
    tier: "assisted",
    role: "",
    timeline: "",
    budget: "",
    churchSize: "",
    theology: "",
    notes: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/inquiries", { method: "POST", body: form });
      setDone(true);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout title="Ask us to run your search">
      <div className="container" style={{ padding: "32px 16px 64px", maxWidth: 640 }}>
        <p className="label">Assisted &amp; full search</p>
        <h1>Let us run the search for you</h1>
        <p className="muted">
          Some churches want to do it themselves — that&apos;s the membership. Others want us to run it: we
          scope the role, shortlist candidates, check references, and stay with you until the hire. Tell us
          about the role and we&apos;ll be in touch.
        </p>
        {done ? (
          <Banner tone="success">Thank you — your inquiry is in. We&apos;ll reach out within one business day.</Banner>
        ) : (
          <form onSubmit={submit}>
            {error && <Banner tone="error">{error.message}</Banner>}
            <div className="field">
              <label htmlFor="contactName">Your name</label>
              <input id="contactName" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="contactEmail">Your email</label>
              <input id="contactEmail" type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="churchName">Church name</label>
              <input id="churchName" value={form.churchName} onChange={(e) => set("churchName", e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="tier">How much help do you want?</label>
              <select id="tier" value={form.tier} onChange={(e) => set("tier", e.target.value)}>
                <option value="assisted">Assisted — we shortlist, you interview and hire</option>
                <option value="full">Full search — we run it end to end, including references and background checks</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="role">Role you&apos;re hiring for</label>
              <input id="role" value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="e.g. Lead pastor, Worship pastor" />
            </div>
            <div className="field">
              <label htmlFor="timeline">Timeline</label>
              <input id="timeline" value={form.timeline} onChange={(e) => set("timeline", e.target.value)} placeholder="e.g. Hoping to hire by spring" />
            </div>
            <div className="field">
              <label htmlFor="budget">Budget for the search</label>
              <input id="budget" value={form.budget} onChange={(e) => set("budget", e.target.value)} placeholder="Optional — a range is fine" />
            </div>
            <div className="field">
              <label htmlFor="churchSize">Church size</label>
              <input id="churchSize" value={form.churchSize} onChange={(e) => set("churchSize", e.target.value)} placeholder="e.g. About 150 on a Sunday" />
            </div>
            <div className="field">
              <label htmlFor="theology">Theology in a sentence or two</label>
              <textarea id="theology" rows={2} value={form.theology} onChange={(e) => set("theology", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="notes">Anything else we should know</label>
              <textarea id="notes" rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send inquiry"}</button>
          </form>
        )}
      </div>
    </Layout>
  );
}
