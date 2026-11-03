import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { ListingFields } from "../listing-fields";
import { createListing } from "../actions";

export const metadata = { title: "Sell an item" };

export default async function NewListingPage() {
  await requireUser("/marketplace/new");
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="page-title">Sell an item</h1>
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        Photos must show only the item — on a hanger, mannequin or flat. No photos of dancers or any people. See{" "}
        <Link href="/safety" className="link">
          safety tips
        </Link>
        .
      </p>
      <div className="card">
        <ActionForm action={createListing} submitLabel="Continue to photos">
          <ListingFields />
        </ActionForm>
      </div>
    </div>
  );
}
