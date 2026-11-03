import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";
import { ActionForm } from "@/components/action-form";
import { Select } from "@/components/fields";
import { ListingFields } from "../../listing-fields";
import { updateListing } from "../../actions";

export const metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }: PageProps<"/marketplace/[id]/edit">) {
  const { id } = await params;
  const account = await requireUser(`/marketplace/${id}/edit`);
  if (!uuidSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: listing } = await supabase.from("listings").select("*").eq("id", id).eq("seller_id", account.id).maybeSingle();
  if (!listing) notFound();
  return (
    <div className="mx-auto max-w-md">
      <h1 className="page-title">Edit listing</h1>
      <div className="card">
        <ActionForm action={updateListing.bind(null, id)} submitLabel="Save changes">
          <ListingFields listing={listing} />
          <Select
            label="Status"
            name="status"
            options={[
              ["active", "Active (for sale)"],
              ["sold", "Sold elsewhere"],
              ["removed", "Removed (hidden)"],
            ]}
            defaultValue={listing.status}
          />
        </ActionForm>
      </div>
    </div>
  );
}
