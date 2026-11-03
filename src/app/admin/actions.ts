"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbError, validationError, type FormState } from "@/lib/form";
import { adminSchoolSchema, feisSchema, formObject, reviewNoteSchema, uuidSchema } from "@/lib/validation";

export async function reviewClaim(claimId: string, approve: boolean, _: FormState, formData: FormData): Promise<FormState> {
  await requirePlatformAdmin();
  if (!uuidSchema.safeParse(claimId).success) return { error: "Not found." };
  const note = reviewNoteSchema.safeParse(formData.get("note") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_school_claim", {
    p_claim: claimId,
    p_approve: approve,
    p_note: note.success ? note.data : null,
  });
  if (error) return dbError(error);
  revalidatePath("/admin");
  return { ok: true, message: approve ? "Approved." : "Rejected." };
}

export async function setFeisStatus(eventId: string, status: "published" | "rejected"): Promise<FormState> {
  await requirePlatformAdmin();
  if (!uuidSchema.safeParse(eventId).success) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("feis_events").update({ status }).eq("id", eventId);
  if (error) return dbError(error);
  revalidatePath("/admin");
  revalidatePath("/feis");
  return { ok: true };
}

export async function adminAddSchool(_: FormState, formData: FormData): Promise<FormState> {
  await requirePlatformAdmin();
  const parsed = adminSchoolSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const d = parsed.data;
  const base = d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "school";
  const slug = `${base}-${crypto.randomUUID().slice(0, 6)}`;
  const supabase = await createClient();
  const { error } = await supabase.from("schools").insert({
    name: d.name,
    slug,
    city: d.city,
    region: d.region,
    country: d.country,
    website_url: d.websiteUrl,
    public_email: d.publicEmail,
    description: d.description,
  });
  if (error) return dbError(error);
  revalidatePath("/schools");
  return { ok: true, message: "School added (unclaimed)." };
}

export async function adminAddFeis(_: FormState, formData: FormData): Promise<FormState> {
  await requirePlatformAdmin();
  const parsed = feisSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feis_events")
    .insert({
      name: d.name,
      starts_on: d.startsOn,
      ends_on: d.endsOn,
      venue_name: d.venueName,
      city: d.city,
      region: d.region,
      country: d.country,
      registration_url: d.registrationUrl,
    })
    .select("id")
    .single();
  if (error || !data) return dbError(error);
  const { error: pubError } = await supabase.from("feis_events").update({ status: "published" }).eq("id", data.id);
  if (pubError) return dbError(pubError);
  revalidatePath("/feis");
  return { ok: true, message: "Event published." };
}

export async function resolveReport(reportId: string): Promise<FormState> {
  await requirePlatformAdmin();
  if (!uuidSchema.safeParse(reportId).success) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("reports").update({ resolved: true }).eq("id", reportId);
  if (error) return dbError(error);
  revalidatePath("/admin");
  return { ok: true };
}

export async function removeListing(listingId: string): Promise<FormState> {
  await requirePlatformAdmin();
  if (!uuidSchema.safeParse(listingId).success) return { error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("listings").update({ status: "removed", removed_by_admin: true }).eq("id", listingId);
  if (error) return dbError(error);
  revalidatePath("/admin");
  return { ok: true, message: "Listing removed." };
}
