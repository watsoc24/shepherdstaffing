import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Purchases & sales" };

type Order = {
  id: string;
  listing_id: string | null;
  listing_title: string;
  buyer_id: string | null;
  amount_cents: number;
  platform_fee_cents: number;
  currency: string;
  status: string;
  created_at: string;
};

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const account = await requireUser("/orders");
  const { checkout } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, listing_id, listing_title, buyer_id, amount_cents, platform_fee_cents, currency, status, created_at")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(200);
  const orders = (data ?? []) as Order[];
  const purchases = orders.filter((o) => o.buyer_id === account.id);
  const sales = orders.filter((o) => o.buyer_id !== account.id);

  const row = (o: Order, sale: boolean) => (
    <li key={o.id} className="card">
      <p className="font-medium">
        {o.listing_id ? (
          <Link href={`/marketplace/${o.listing_id}`} className="link">
            {o.listing_title}
          </Link>
        ) : (
          o.listing_title
        )}
      </p>
      <p className="text-sm text-gray-500">
        {formatMoney(o.amount_cents, o.currency)}
        {sale ? ` (platform fee ${formatMoney(o.platform_fee_cents, o.currency)})` : ""} ·{" "}
        <span className="badge">{o.status}</span> · {new Date(o.created_at).toLocaleDateString()}
      </p>
    </li>
  );

  return (
    <div className="space-y-6">
      <h1 className="page-title">Purchases &amp; sales</h1>
      {checkout === "success" ? (
        <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
          Payment received by Stripe. It can take a minute to show as paid here. Message the seller to arrange
          delivery.
        </p>
      ) : null}
      <section>
        <h2 className="mb-2 font-semibold">Purchases</h2>
        {purchases.length ? <ul className="space-y-2">{purchases.map((o) => row(o, false))}</ul> : <p className="text-gray-600">None yet.</p>}
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Sales</h2>
        {sales.length ? <ul className="space-y-2">{sales.map((o) => row(o, true))}</ul> : <p className="text-gray-600">None yet.</p>}
        <p className="mt-2 text-sm text-gray-500">
          Buyer shipping addresses and payouts are in your Stripe dashboard.
        </p>
      </section>
    </div>
  );
}
