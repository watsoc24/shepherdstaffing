import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedPhotoUrls } from "@/lib/photos";
import { uuidSchema } from "@/lib/validation";
import { deleteListingPhoto } from "../../actions";
import { PhotoUploader } from "./uploader";

export const metadata = { title: "Listing photos" };

export default async function ListingPhotosPage({ params }: PageProps<"/marketplace/[id]/photos">) {
  const { id } = await params;
  const account = await requireUser(`/marketplace/${id}/photos`);
  if (!uuidSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, listing_photos(id, storage_path, position)")
    .eq("id", id)
    .eq("seller_id", account.id)
    .maybeSingle();
  if (!listing) notFound();
  const photos = [...listing.listing_photos].sort((a, b) => a.position - b.position);
  const urls = await signedPhotoUrls(supabase, photos.map((p) => p.storage_path));

  return (
    <div className="space-y-4">
      <h1 className="page-title">Photos for “{listing.title}”</h1>
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        Item only, please — no dancers or other people. Hidden location data is removed from every photo
        automatically.
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <li key={p.id} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urls[p.storage_path]} alt="" className="aspect-square w-full rounded-xl object-cover" />
            <form action={async () => { "use server"; await deleteListingPhoto(p.id); }}>
              <button className="absolute top-1 right-1 rounded-full bg-white/90 px-2 text-sm font-bold text-red-700" aria-label="Delete photo">
                ✕
              </button>
            </form>
          </li>
        ))}
      </ul>
      <div className="card">
        <PhotoUploader listingId={id} remaining={8 - photos.length} />
      </div>
      <Link href={`/marketplace/${id}`} className="btn w-full">
        Done — view listing
      </Link>
    </div>
  );
}
