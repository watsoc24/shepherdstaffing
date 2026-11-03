"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITED } from "@/lib/rate-limit";
import { dbError, validationError, type FormState } from "@/lib/form";
import { formObject, listingSchema, listingStatusSchema, reportSchema, uuidSchema } from "@/lib/validation";

function listingRow(data: ReturnType<typeof listingSchema.parse>) {
  return {
    title: data.title,
    description: data.description,
    category: data.category,
    size_label: data.size_label,
    price_cents: data.price,
    shipping_cents: data.shipping,
    condition: data.condition,
    city: data.city,
    region: data.region,
    country: data.country,
  };
}

export async function createListing(_: FormState, formData: FormData): Promise<FormState> {
  const account = await requireUser("/marketplace/new");
  const parsed = listingSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  if (!(await rateLimit("listing-create", 20, 86400, account.id))) return RATE_LIMITED;
  const supabase = await createClient();
  const { data, error } = await supabase.from("listings").insert(listingRow(parsed.data)).select("id").single();
  if (error || !data) return dbError(error);
  redirect(`/marketplace/${data.id}/photos?new=1`);
}

export async function updateListing(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireUser("/marketplace/mine");
  if (!uuidSchema.safeParse(id).success) return { error: "Not found." };
  const raw = formObject(formData);
  const parsed = listingSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const status = listingStatusSchema.safeParse(raw);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .update({ ...listingRow(parsed.data), ...(status.success ? { status: status.data.status } : {}) })
    .eq("id", id)
    .select("id");
  if (error) return dbError(error);
  if (!data?.length) return { error: "Not found." };
  redirect(`/marketplace/${id}`);
}

const MAX_UPLOAD_BYTES = 2.5 * 1024 * 1024;

/**
 * Receives one photo (already shrunk in the browser), re-encodes it on the
 * server — which strips EXIF/GPS and any other hidden metadata — and stores it.
 */
export async function uploadListingPhoto(listingId: string, formData: FormData): Promise<FormState> {
  const account = await requireUser("/marketplace/mine");
  if (!uuidSchema.safeParse(listingId).success) return { error: "Not found." };
  if (formData.get("attest") !== "yes") {
    return { error: "Please confirm the photo shows only the item — no people." };
  }
  if (!(await rateLimit("photo-upload", 60, 3600, account.id))) return RATE_LIMITED;

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "That photo is too large." };

  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, seller_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || listing.seller_id !== account.id) return { error: "Not found." };

  let jpeg: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { limitInputPixels: 40_000_000, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.format || !["jpeg", "png", "webp", "heif", "avif"].includes(meta.format)) {
      return { error: "Please upload a JPEG, PNG, WebP or HEIC photo." };
    }
    jpeg = await image
      .rotate() // apply orientation, then metadata is dropped on output
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch {
    return { error: "We couldn't read that image. Try a different photo." };
  }

  const path = `${account.id}/${listingId}/${randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("listing-photos")
    .upload(path, jpeg, { contentType: "image/jpeg", upsert: false });
  if (uploadError) return { error: "Upload failed. Please try again." };

  const { count } = await supabase
    .from("listing_photos")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  const { error } = await supabase
    .from("listing_photos")
    .insert({ listing_id: listingId, storage_path: path, position: Math.min(count ?? 0, 7) });
  if (error) {
    await supabase.storage.from("listing-photos").remove([path]);
    return dbError(error);
  }
  revalidatePath(`/marketplace/${listingId}`);
  return { ok: true };
}

export async function deleteListingPhoto(photoId: string): Promise<FormState> {
  await requireUser("/marketplace/mine");
  if (!uuidSchema.safeParse(photoId).success) return { error: "Not found." };
  const supabase = await createClient();
  const { data } = await supabase.from("listing_photos").delete().eq("id", photoId).select("storage_path, listing_id");
  const row = data?.[0];
  if (!row) return { error: "Not found." };
  await supabase.storage.from("listing-photos").remove([row.storage_path]);
  revalidatePath(`/marketplace/${row.listing_id}/photos`);
  return { ok: true };
}

export async function fileReport(_: FormState, formData: FormData): Promise<FormState> {
  const account = await requireUser("/marketplace");
  const parsed = reportSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  if (!(await rateLimit("report", 20, 86400, account.id))) return RATE_LIMITED;
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
  });
  if (error) return dbError(error);
  return { ok: true, message: "Thanks — our team will review this." };
}
