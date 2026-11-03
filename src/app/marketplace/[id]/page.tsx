import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedPhotoUrls } from "@/lib/photos";
import { categoryLabel, conditionLabel, uuidSchema } from "@/lib/validation";
import { formatMoney, platformFeeCents } from "@/lib/money";
import { env } from "@/lib/env";
import { ActionForm } from "@/components/action-form";
import { TextArea } from "@/components/fields";
import { startConversation } from "@/app/messages/actions";
import { buyListing } from "@/app/orders/actions";
import { fileReport } from "../actions";

export const metadata = { title: "Listing" };

export default async function ListingPage({ params }: PageProps<"/marketplace/[id]">) {
  const { id } = await params;
  const account = await requireUser(`/marketplace/${id}`);
  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("*, listing_photos(id, storage_path, position)")
    .eq("id", id)
    .maybeSingle();
  if (!listing) notFound();

  const isOwner = listing.seller_id === account.id;
  const photos = [...(listing.listing_photos ?? [])].sort((a, b) => a.position - b.position);
  const [urls, { data: seller }, { data: canPay }, { data: convo }] = await Promise.all([
    signedPhotoUrls(supabase, photos.map((p) => p.storage_path)),
    supabase.from("profiles").select("display_name").eq("id", listing.seller_id).maybeSingle(),
    supabase.rpc("seller_can_accept_payments", { p_seller: listing.seller_id }),
    supabase.from("conversations").select("id").eq("listing_id", id).eq("buyer_id", account.id).maybeSingle(),
  ]);
  const total = listing.price_cents + listing.shipping_cents;
  const canBuy = !isOwner && listing.status === "active" && canPay === true && env.stripeConfigured;

  return (
    <div className="space-y-4">
      {photos.length ? (
        <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4">
          {photos.map((p) =>
            urls[p.storage_path] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={urls[p.storage_path]} alt={`Photo of ${listing.title}`} className="aspect-square w-4/5 shrink-0 snap-center rounded-2xl object-cover sm:w-1/2" />
            ) : null,
          )}
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-2xl bg-gray-100 text-gray-400">No photos yet</div>
      )}

      <div>
        <h1 className="text-2xl font-bold">{listing.title}</h1>
        <p className="text-xl font-bold text-brand-700">{formatMoney(listing.price_cents, listing.currency)}</p>
        <p className="text-sm text-gray-600">
          {listing.shipping_cents > 0
            ? `+ ${formatMoney(listing.shipping_cents, listing.currency)} shipping (within ${listing.country})`
            : "Local pickup / no shipping charge"}
        </p>
        {listing.status !== "active" ? <span className="badge mt-2">{listing.status}</span> : null}
      </div>

      <dl className="card grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-500">Category</dt>
        <dd>{categoryLabel(listing.category)}</dd>
        <dt className="text-gray-500">Size</dt>
        <dd>{listing.size_label}</dd>
        <dt className="text-gray-500">Condition</dt>
        <dd>{conditionLabel(listing.condition)}</dd>
        <dt className="text-gray-500">Location</dt>
        <dd>
          {listing.city}, {listing.region}, {listing.country}
        </dd>
        <dt className="text-gray-500">Seller</dt>
        <dd>{seller?.display_name ?? "Member"}</dd>
      </dl>

      {listing.description ? <p className="whitespace-pre-line text-gray-800">{listing.description}</p> : null}

      {isOwner ? (
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/marketplace/${id}/edit`} className="btn-secondary">
            Edit
          </Link>
          <Link href={`/marketplace/${id}/photos`} className="btn-secondary">
            Photos
          </Link>
          {canPay !== true ? (
            <Link href="/sell/payouts" className="btn col-span-2">
              Set up payouts so buyers can pay
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          {canBuy ? (
            <ActionForm action={buyListing.bind(null, id)} submitLabel={`Buy now · ${formatMoney(total, listing.currency)}`} pendingLabel="Opening secure checkout…">
              <p className="text-xs text-gray-500">
                You&apos;ll pay on Stripe&apos;s secure checkout page. Card details never touch our servers.
              </p>
            </ActionForm>
          ) : listing.status === "active" ? (
            <p className="rounded-xl bg-gray-100 p-3 text-sm text-gray-700">
              Online checkout isn&apos;t available for this item yet. You can message the seller.
            </p>
          ) : null}

          {convo ? (
            <Link href={`/messages/${convo.id}`} className="btn-secondary w-full">
              Open your conversation
            </Link>
          ) : listing.status === "active" ? (
            <div className="card">
              <h2 className="mb-2 font-semibold">Message the seller</h2>
              <ActionForm action={startConversation.bind(null, id)} submitLabel="Send message" buttonClassName="btn-secondary w-full">
                <TextArea label="Message" name="body" required maxLength={2000} defaultValue="Hi! Is this still available?" />
              </ActionForm>
            </div>
          ) : null}

          <details className="text-sm">
            <summary className="cursor-pointer text-gray-500">Report this listing</summary>
            <div className="mt-2">
              <ActionForm action={fileReport} submitLabel="Send report" buttonClassName="btn-secondary w-full">
                <input type="hidden" name="targetType" value="listing" />
                <input type="hidden" name="targetId" value={id} />
                <TextArea label="What's wrong?" name="reason" required minLength={5} maxLength={1000} hint="For example: photo shows a child, suspected scam, counterfeit." />
              </ActionForm>
            </div>
          </details>
        </>
      )}
      {isOwner ? (
        <p className="text-xs text-gray-500">
          When this sells online, a 7% platform fee ({formatMoney(platformFeeCents(total), listing.currency)}) is
          deducted, plus Stripe&apos;s own card processing fee.
        </p>
      ) : null}
    </div>
  );
}
