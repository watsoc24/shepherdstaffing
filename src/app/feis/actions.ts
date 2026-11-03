"use server";

import { redirect } from "next/navigation";
import { requireSchoolAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITED } from "@/lib/rate-limit";
import { dbError, validationError, type FormState } from "@/lib/form";
import { feisSchema, formObject } from "@/lib/validation";

export async function submitFeis(_: FormState, formData: FormData): Promise<FormState> {
  const account = await requireSchoolAdmin("/feis/submit");
  const parsed = feisSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  if (!parsed.data.hostSchoolId) return { error: "Choose the host school." };
  if (!(await rateLimit("feis-submit", 20, 86400, account.id))) return RATE_LIMITED;
  const supabase = await createClient();
  const d = parsed.data;
  const { error } = await supabase.from("feis_events").insert({
    name: d.name,
    starts_on: d.startsOn,
    ends_on: d.endsOn,
    venue_name: d.venueName,
    city: d.city,
    region: d.region,
    country: d.country,
    registration_url: d.registrationUrl,
    host_school_id: d.hostSchoolId,
  });
  if (error) return dbError(error);
  redirect("/feis?submitted=1");
}
