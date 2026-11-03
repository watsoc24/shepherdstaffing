import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Creates short-lived signed URLs. Storage RLS decides what the user may see. */
export async function signedPhotoUrls(supabase: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from("listing-photos").createSignedUrls(paths, 60 * 30);
  const out: Record<string, string> = {};
  for (const item of data ?? []) if (item.signedUrl && item.path) out[item.path] = item.signedUrl;
  return out;
}
