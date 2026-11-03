"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { dbError, validationError, type FormState } from "@/lib/form";
import { formObject, messageSchema, uuidSchema } from "@/lib/validation";

const SLOW_DOWN = { error: "You're sending messages too quickly. Please wait a minute." };

export async function startConversation(listingId: string, _: FormState, formData: FormData): Promise<FormState> {
  const account = await requireUser(`/marketplace/${listingId}`);
  if (!uuidSchema.safeParse(listingId).success) return { error: "Not found." };
  const parsed = messageSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  if (!(await rateLimit("conversation-start", 20, 3600, account.id))) return SLOW_DOWN;

  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, seller_id, status")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || listing.status !== "active") return { error: "This listing is no longer available." };
  if (listing.seller_id === account.id) return { error: "This is your own listing." };

  let conversationId: string | undefined;
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", account.id)
    .maybeSingle();
  conversationId = existing?.id;
  if (!conversationId) {
    const { data, error } = await supabase
      .from("conversations")
      .insert({ listing_id: listingId, seller_id: listing.seller_id })
      .select("id")
      .single();
    if (error || !data) return dbError(error);
    conversationId = data.id;
  }

  const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, body: parsed.data.body });
  if (error) return dbError(error);
  redirect(`/messages/${conversationId}`);
}

export async function sendMessage(conversationId: string, _: FormState, formData: FormData): Promise<FormState> {
  const account = await requireUser(`/messages/${conversationId}`);
  if (!uuidSchema.safeParse(conversationId).success) return { error: "Not found." };
  const parsed = messageSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  // App-level limit in addition to the database trigger.
  if (!(await rateLimit("message-send", 10, 60, account.id))) return SLOW_DOWN;

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, body: parsed.data.body });
  if (error) return dbError(error);
  revalidatePath(`/messages/${conversationId}`);
  return { ok: true };
}
