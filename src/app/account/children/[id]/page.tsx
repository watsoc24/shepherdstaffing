import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { uuidSchema } from "@/lib/validation";
import { ChildFields } from "../child-form";
import { deleteChild, updateChild } from "../../actions";

export const metadata = { title: "Edit dancer" };

export default async function EditChildPage({ params }: PageProps<"/account/children/[id]">) {
  const { id } = await params;
  await requireUser("/account/children");
  if (!uuidSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const [{ data: child }, { data: schools }] = await Promise.all([
    supabase.from("children").select("nickname, birth_year, dance_level, school_id").eq("id", id).maybeSingle(),
    supabase.from("schools").select("id, name").order("name").limit(1000),
  ]);
  if (!child) notFound();

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="page-title">Edit dancer</h1>
      <div className="card">
        <ActionForm action={updateChild.bind(null, id)} submitLabel="Save changes">
          <ChildFields child={child} schools={schools ?? []} />
        </ActionForm>
      </div>
      <ActionForm action={deleteChild.bind(null, id)} submitLabel="Delete this dancer profile" buttonClassName="btn-danger w-full" />
    </div>
  );
}
