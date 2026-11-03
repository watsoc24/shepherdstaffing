import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";
import { ActionForm } from "@/components/action-form";
import { sendMessage } from "../actions";
import { AutoRefresh } from "./auto-refresh";

export const metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  const { id } = await params;
  const account = await requireUser(`/messages/${id}`);
  if (!uuidSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: convo } = await supabase
    .from("conversations")
    .select("id, listing_id, buyer_id, seller_id, listings(title)")
    .eq("id", id)
    .maybeSingle();
  if (!convo) notFound();

  const otherId = convo.buyer_id === account.id ? convo.seller_id : convo.buyer_id;
  const [{ data: messages }, { data: other }] = await Promise.all([
    supabase.from("messages").select("id, sender_id, body, created_at").eq("conversation_id", id).order("created_at").limit(500),
    supabase.from("profiles").select("display_name").eq("id", otherId).maybeSingle(),
  ]);

  return (
    <div className="space-y-4">
      <AutoRefresh />
      <div>
        <h1 className="text-xl font-bold">{other?.display_name ?? "Member"}</h1>
        <Link href={`/marketplace/${convo.listing_id}`} className="link text-sm">
          {(convo.listings as unknown as { title: string } | null)?.title ?? "View listing"}
        </Link>
      </div>
      <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
        Stay safe: pay through the Buy button, not by bank transfer or gift card. Meet in public places for pickup and
        don&apos;t share your home address or your child&apos;s details.
      </p>
      <ul className="space-y-2">
        {(messages ?? []).map((m) => {
          const mine = m.sender_id === account.id;
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? "bg-brand-600 text-white" : "bg-white shadow-sm"}`}>
                <p className="text-base whitespace-pre-line break-words">{m.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? "text-white/70" : "text-gray-400"}`}>
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <ActionForm action={sendMessage.bind(null, id)} submitLabel="Send" className="space-y-2">
        <label htmlFor="body" className="sr-only">
          Message
        </label>
        <textarea id="body" name="body" required maxLength={2000} className="input min-h-20" placeholder="Write a message…" />
      </ActionForm>
    </div>
  );
}
