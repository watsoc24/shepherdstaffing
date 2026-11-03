import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { ChildFields } from "../child-form";
import { createChild } from "../../actions";

export const metadata = { title: "Add a dancer" };

export default async function NewChildPage() {
  await requireUser("/account/children/new");
  const supabase = await createClient();
  const { data: schools } = await supabase.from("schools").select("id, name").order("name").limit(1000);
  return (
    <div className="mx-auto max-w-md">
      <h1 className="page-title">Add a dancer</h1>
      <div className="card">
        <ActionForm action={createChild} submitLabel="Save">
          <ChildFields schools={schools ?? []} />
        </ActionForm>
      </div>
    </div>
  );
}
