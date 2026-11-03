import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { TextArea, TextField } from "@/components/fields";
import { FeisFields } from "@/app/feis/feis-fields";
import { adminAddFeis, adminAddSchool, removeListing, resolveReport, reviewClaim, setFeisStatus } from "./actions";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const [{ data: claims }, { data: events }, { data: reports }] = await Promise.all([
    supabase
      .from("school_claims")
      .select("id, school_id, proposed_name, proposed_city, proposed_region, proposed_website, claimant_title, contact_email, evidence, created_at, schools(name, website_url)")
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("feis_events")
      .select("id, name, starts_on, ends_on, city, region, country, registration_url, schools(name)")
      .eq("status", "pending")
      .order("created_at"),
    supabase.from("reports").select("id, target_type, target_id, reason, created_at").eq("resolved", false).order("created_at"),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="page-title">Platform admin</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">School claims ({claims?.length ?? 0})</h2>
        <p className="text-sm text-gray-600">
          Verify independently: email the address shown on the school&apos;s official website (not the address in
          the claim) or check with the governing body. Approving gives this person edit rights.
        </p>
        {(claims ?? []).map((c) => {
          const s = c.schools as unknown as { name: string; website_url: string | null } | null;
          return (
            <div key={c.id} className="card space-y-2 text-sm">
              <p className="font-semibold">{s?.name ?? `${c.proposed_name} (new school)`}</p>
              {!s ? <p>{[c.proposed_city, c.proposed_region].filter(Boolean).join(", ")} {c.proposed_website}</p> : null}
              {s?.website_url ? <p>Listed website: {s.website_url}</p> : null}
              <p>
                Claimant: {c.claimant_title} · {c.contact_email}
              </p>
              <p className="whitespace-pre-line text-gray-700">{c.evidence}</p>
              <div className="grid grid-cols-2 gap-2">
                <ActionForm action={reviewClaim.bind(null, c.id, true)} submitLabel="Approve" className="space-y-2">
                  <TextField label="Note" name="note" maxLength={500} />
                </ActionForm>
                <ActionForm action={reviewClaim.bind(null, c.id, false)} submitLabel="Reject" buttonClassName="btn-danger w-full" className="space-y-2">
                  <TextField label="Reason" name="note" maxLength={500} />
                </ActionForm>
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pending feiseanna ({events?.length ?? 0})</h2>
        {(events ?? []).map((e) => (
          <div key={e.id} className="card space-y-2 text-sm">
            <p className="font-semibold">{e.name}</p>
            <p>
              {e.starts_on} → {e.ends_on} · {[e.city, e.region, e.country].filter(Boolean).join(", ")} · host:{" "}
              {(e.schools as unknown as { name: string } | null)?.name ?? "—"}
            </p>
            <a href={e.registration_url} target="_blank" rel="noopener noreferrer nofollow" className="link break-all">
              {e.registration_url}
            </a>
            <p className="text-gray-600">Check the date on the organizer&apos;s site before publishing.</p>
            <div className="grid grid-cols-2 gap-2">
              <ActionForm action={setFeisStatus.bind(null, e.id, "published")} submitLabel="Publish" className="" />
              <ActionForm action={setFeisStatus.bind(null, e.id, "rejected")} submitLabel="Reject" buttonClassName="btn-danger w-full" className="" />
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Open reports ({reports?.length ?? 0})</h2>
        {(reports ?? []).map((r) => (
          <div key={r.id} className="card space-y-2 text-sm">
            <p>
              <span className="badge">{r.target_type}</span>{" "}
              {r.target_type === "listing" ? (
                <Link href={`/marketplace/${r.target_id}`} className="link">
                  View listing
                </Link>
              ) : (
                r.target_id
              )}
            </p>
            <p className="whitespace-pre-line">{r.reason}</p>
            <div className="grid grid-cols-2 gap-2">
              {r.target_type === "listing" ? (
                <ActionForm action={removeListing.bind(null, r.target_id)} submitLabel="Remove listing" buttonClassName="btn-danger w-full" className="" />
              ) : (
                <span />
              )}
              <ActionForm action={resolveReport.bind(null, r.id)} submitLabel="Mark resolved" buttonClassName="btn-secondary w-full" className="" />
            </div>
          </div>
        ))}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Add a school (unclaimed)</h2>
        <p className="text-sm text-gray-600">Only add schools from a source you can cite, such as a governing body&apos;s public register.</p>
        <ActionForm action={adminAddSchool} submitLabel="Add school">
          <TextField label="Name" name="name" required maxLength={120} />
          <TextField label="City" name="city" maxLength={80} />
          <TextField label="State / region" name="region" maxLength={80} />
          <TextField label="Country" name="country" maxLength={56} />
          <TextField label="Website" name="websiteUrl" type="url" maxLength={300} />
          <TextField label="Public email" name="publicEmail" type="email" maxLength={254} />
          <TextArea label="Description" name="description" maxLength={2000} />
        </ActionForm>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Add a feis (published immediately)</h2>
        <p className="text-sm text-gray-600">Copy dates exactly from the official registration page.</p>
        <ActionForm action={adminAddFeis} submitLabel="Publish event">
          <FeisFields />
        </ActionForm>
      </section>
    </div>
  );
}
