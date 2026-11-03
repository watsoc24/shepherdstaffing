"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITED } from "@/lib/rate-limit";
import { dbError, validationError, type FormState } from "@/lib/form";
import { childSchema, displayNameSchema, formObject, uuidSchema } from "@/lib/validation";

export async function updateDisplayName(_: FormState, formData: FormData): Promise<FormState> {
  const account = await requireUser();
  const parsed = displayNameSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: parsed.data.displayName }).eq("id", account.id);
  if (error) return dbError(error);
  revalidatePath("/account");
  return { ok: true, message: "Saved." };
}

export async function createChild(_: FormState, formData: FormData): Promise<FormState> {
  await requireUser("/account/children");
  const parsed = childSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("children").insert({
    nickname: parsed.data.nickname,
    birth_year: parsed.data.birthYear,
    dance_level: parsed.data.danceLevel,
    school_id: parsed.data.schoolId,
  });
  if (error) return dbError(error);
  redirect("/account/children");
}

export async function updateChild(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireUser("/account/children");
  if (!uuidSchema.safeParse(id).success) return { error: "Not found." };
  const parsed = childSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("children")
    .update({
      nickname: parsed.data.nickname,
      birth_year: parsed.data.birthYear,
      dance_level: parsed.data.danceLevel,
      school_id: parsed.data.schoolId,
    })
    .eq("id", id)
    .select("id");
  if (error) return dbError(error);
  if (!data?.length) return { error: "Not found." };
  redirect("/account/children");
}

export async function deleteChild(id: string): Promise<FormState> {
  await requireUser("/account/children");
  if (!uuidSchema.safeParse(id).success) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("children").delete().eq("id", id);
  if (error) return dbError(error);
  redirect("/account/children");
}

/** Permanently deletes the account and everything it owns. */
export async function deleteAccount(_: FormState, formData: FormData): Promise<FormState> {
  const account = await requireUser();
  if (formData.get("confirm") !== "DELETE") return { error: 'Type DELETE (in capitals) to confirm.' };
  if (!(await rateLimit("delete-account", 3, 3600, account.id))) return RATE_LIMITED;

  // Remove this user's photos from storage (their folder only, via RLS).
  const supabase = await createClient();
  const { data: folders } = await supabase.storage.from("listing-photos").list(account.id, { limit: 1000 });
  for (const folder of folders ?? []) {
    const prefix = `${account.id}/${folder.name}`;
    const { data: files } = await supabase.storage.from("listing-photos").list(prefix, { limit: 100 });
    const paths = (files ?? []).map((f) => `${prefix}/${f.name}`);
    if (paths.length) await supabase.storage.from("listing-photos").remove(paths);
  }

  // Deleting the auth user cascades to profile, children, listings, messages.
  // Completed orders keep amounts for accounting but lose the link to this user.
  const { error } = await createAdminClient().auth.admin.deleteUser(account.id);
  if (error) {
    console.error("delete account failed", error.code);
    return { error: "We couldn't delete your account. Please contact support." };
  }
  await supabase.auth.signOut();
  redirect("/?notice=account-deleted");
}
