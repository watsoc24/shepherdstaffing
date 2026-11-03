import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signedPhotoUrls } from "@/lib/photos";
import { CATEGORIES, categoryLabel, conditionLabel, searchTerm } from "@/lib/validation";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Marketplace" };

const PAGE_SIZE = 24;

export default async function MarketplacePage({ searchParams }: PageProps<"/marketplace">) {
  await requireUser("/marketplace");
  const sp = await searchParams;
  const q = searchTerm(sp.q);
  const category = typeof sp.category === "string" && CATEGORIES.some(([c]) => c === sp.category) ? sp.category : "";
  const page = Math.max(0, Math.min(100, Number(sp.page) || 0));

  const supabase = await createClient();
  let query = supabase
    .from("listings")
    .select("id, title, category, size_label, price_cents, currency, condition, city, region, listing_photos(storage_path, position)")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (category) query = query.eq("category", category);
  if (q) query = query.ilike("title", `%${q}%`);
  const { data: listings } = await query;

  const firstPhoto = (l: NonNullable<typeof listings>[number]) =>
    [...(l.listing_photos ?? [])].sort((a, b) => a.position - b.position)[0]?.storage_path;
  const urls = await signedPhotoUrls(supabase, (listings ?? []).map(firstPhoto).filter(Boolean) as string[]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title mb-0">Dress &amp; gear</h1>
        <Link href="/marketplace/new" className="btn">
          Sell
        </Link>
      </div>
      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search titles" className="input" maxLength={60} aria-label="Search titles" />
        <select name="category" defaultValue={category} className="input max-w-40" aria-label="Category">
          <option value="">All</option>
          {CATEGORIES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Go</button>
      </form>

      {listings?.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {listings.map((l) => {
            const photo = firstPhoto(l);
            return (
              <li key={l.id}>
                <Link href={`/marketplace/${l.id}`} className="card block overflow-hidden p-0">
                  <div className="aspect-square bg-gray-100">
                    {photo && urls[photo] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={urls[photo]} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-gray-400">No photo</div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-semibold">{l.title}</p>
                    <p className="text-sm font-bold text-brand-700">{formatMoney(l.price_cents, l.currency)}</p>
                    <p className="text-xs text-gray-500">
                      {categoryLabel(l.category)} · {l.size_label} · {conditionLabel(l.condition)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {l.city}, {l.region}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="card text-gray-600">No listings match yet. Be the first to list something!</p>
      )}

      <div className="flex justify-between">
        {page > 0 ? (
          <Link className="link" href={{ query: { q, category, page: page - 1 } }}>
            ← Newer
          </Link>
        ) : (
          <span />
        )}
        {listings?.length === PAGE_SIZE ? (
          <Link className="link" href={{ query: { q, category, page: page + 1 } }}>
            Older →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
