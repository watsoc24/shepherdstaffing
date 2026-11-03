import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "My listings" };

export default async function MyListingsPage() {
  const account = await requireUser("/marketplace/mine");
  const supabase = await createClient();
  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, price_cents, currency, status")
    .eq("seller_id", account.id)
    .order("created_at", { ascending: false });
  return (
    <div className="space-y-4">
      <h1 className="page-title">My listings</h1>
      {listings?.length ? (
        <ul className="space-y-2">
          {listings.map((l) => (
            <li key={l.id}>
              <Link href={`/marketplace/${l.id}`} className="card flex items-center justify-between">
                <span className="font-medium">{l.title}</span>
                <span className="text-sm text-gray-500">
                  {formatMoney(l.price_cents, l.currency)} · <span className="badge">{l.status}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-600">You haven&apos;t listed anything yet.</p>
      )}
      <Link href="/marketplace/new" className="btn w-full">
        List an item
      </Link>
    </div>
  );
}
