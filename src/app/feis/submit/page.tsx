import Link from "next/link";
import { requireSchoolAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { Select } from "@/components/fields";
import { FeisFields } from "../feis-fields";
import { submitFeis } from "../actions";

export const metadata = { title: "Submit a feis" };

export default async function SubmitFeisPage() {
  const account = await requireSchoolAdmin("/feis/submit");
  const supabase = await createClient();
  const { data: memberships } = await supabase.from("school_admins").select("schools(id, name)").eq("user_id", account.id);
  const schools = (memberships ?? []).map((m) => m.schools as unknown as { id: string; name: string }).filter(Boolean);

  if (!schools.length) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="page-title">Submit a feis</h1>
        <p className="card text-gray-700">
          Only verified schools can submit events. Claim your school first.{" "}
          <Link href="/schools" className="link">
            Find your school
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="page-title">Submit a feis</h1>
      <p className="text-sm text-gray-600">Events are reviewed before they appear. We only link to the official registration page.</p>
      <div className="card">
        <ActionForm action={submitFeis} submitLabel="Submit for review">
          <Select label="Host school" name="hostSchoolId" options={schools.map((s) => [s.id, s.name] as const)} required />
          <FeisFields />
        </ActionForm>
      </div>
    </div>
  );
}
