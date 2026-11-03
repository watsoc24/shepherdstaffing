import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const account = await requireUser("/messages");
  const supabase = await createClient();
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id, last_message_at, listings(title)")
    .order("last_message_at", { ascending: false })
    .limit(100);

  const otherIds = [...new Set((conversations ?? []).map((c) => (c.buyer_id === account.id ? c.seller_id : c.buyer_id)))];
  const { data: profiles } = otherIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", otherIds)
    : { data: [] };
  const nameOf = (id: string) => profiles?.find((p) => p.id === id)?.display_name ?? "Member";

  return (
    <div className="space-y-4">
      <h1 className="page-title">Messages</h1>
      {conversations?.length ? (
        <ul className="space-y-2">
          {conversations.map((c) => {
            const other = c.buyer_id === account.id ? c.seller_id : c.buyer_id;
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="card block">
                  <p className="font-semibold">{(c.listings as unknown as { title: string } | null)?.title ?? "Listing"}</p>
                  <p className="text-sm text-gray-500">
                    {c.buyer_id === account.id ? "Seller" : "Buyer"}: {nameOf(other)} ·{" "}
                    {new Date(c.last_message_at).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-gray-600">No conversations yet. Message a seller from any listing.</p>
      )}
    </div>
  );
}
