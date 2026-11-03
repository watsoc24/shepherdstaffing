import Link from "next/link";
import { requireSchoolAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { TextArea, TextField } from "@/components/fields";
import { updateSchool } from "../actions";

export const metadata = { title: "My school" };

type School = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  region: string | null;
  country: string | null;
  website_url: string | null;
  public_email: string | null;
  description: string | null;
};

export default async function ManageSchoolPage({ searchParams }: PageProps<"/schools/manage">) {
  const account = await requireSchoolAdmin("/schools/manage");
  const { claimed } = await searchParams;
  const supabase = await createClient();
  const [{ data: memberships }, { data: claims }] = await Promise.all([
    supabase.from("school_admins").select("schools(*)").eq("user_id", account.id),
    supabase
      .from("school_claims")
      .select("id, status, proposed_name, reviewer_note, created_at, schools(name)")
      .order("created_at", { ascending: false }),
  ]);
  const schools = (memberships ?? []).map((m) => m.schools as unknown as School).filter(Boolean);

  return (
    <div className="space-y-6">
      <h1 className="page-title">My school</h1>
      {claimed ? (
        <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
          Claim submitted. We&apos;ll contact you at the email you gave us.
        </p>
      ) : null}

      {schools.map((s) => (
        <section key={s.id} className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{s.name}</h2>
            <Link href={`/schools/${s.slug}`} className="link text-sm">
              View public page
            </Link>
          </div>
          <ActionForm action={updateSchool.bind(null, s.id)} submitLabel="Save school details">
            <TextField label="City" name="city" maxLength={80} defaultValue={s.city ?? ""} />
            <TextField label="State / region" name="region" maxLength={80} defaultValue={s.region ?? ""} />
            <TextField label="Country" name="country" maxLength={56} defaultValue={s.country ?? ""} />
            <TextField label="Website" name="websiteUrl" type="url" maxLength={300} placeholder="https://" defaultValue={s.website_url ?? ""} />
            <TextField label="Public contact email" name="publicEmail" type="email" maxLength={254} defaultValue={s.public_email ?? ""} />
            <TextArea
              label="About the school"
              name="description"
              maxLength={2000}
              defaultValue={s.description ?? ""}
              hint="Public. Don't include students' names or photos."
            />
          </ActionForm>
          <p className="text-xs text-gray-500">To change the school&apos;s name, contact the platform team.</p>
        </section>
      ))}

      {claims?.length ? (
        <section>
          <h2 className="mb-2 font-semibold">Your claims</h2>
          <ul className="space-y-2">
            {claims.map((c) => (
              <li key={c.id} className="card text-sm">
                <span className="font-medium">{(c.schools as unknown as { name: string } | null)?.name ?? c.proposed_name}</span> ·{" "}
                <span className="badge">{c.status}</span>
                {c.reviewer_note ? <p className="mt-1 text-gray-600">Note: {c.reviewer_note}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!schools.length ? (
        <Link href="/schools" className="btn w-full">
          Find and claim your school
        </Link>
      ) : (
        <Link href="/feis/submit" className="btn-secondary w-full">
          Submit a feis
        </Link>
      )}
    </div>
  );
}
