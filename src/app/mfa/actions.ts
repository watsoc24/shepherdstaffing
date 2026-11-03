"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "@/lib/auth";
import { rateLimit, RATE_LIMITED } from "@/lib/rate-limit";
import type { FormState } from "@/lib/form";
import { safeNext } from "@/lib/safe-redirect";
import { formObject } from "@/lib/validation";

export type EnrollResult = { factorId: string; qrCode: string; secret: string } | { error: string };

export async function startTotpEnrollment(): Promise<EnrollResult> {
  const account = await getAccount();
  if (!account) redirect("/login?next=/mfa");
  if (!(await rateLimit("mfa-enroll", 10, 3600, account.id))) return RATE_LIMITED as { error: string };

  const supabase = await createClient();
  // Clear abandoned, never-verified setups so the user can start over.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16)}`,
  });
  if (error || !data) return { error: "Couldn't start two-step setup. Please try again." };
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

const verifySchema = z.object({
  factorId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, { error: "Enter the 6-digit code from your authenticator app." }),
  next: z.string().optional(),
});

export async function verifyTotp(_: FormState, formData: FormData): Promise<FormState> {
  const account = await getAccount();
  if (!account) redirect("/login?next=/mfa");
  const parsed = verifySchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid code." };
  if (!(await rateLimit("mfa-verify", 10, 900, account.id))) return RATE_LIMITED;

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: parsed.data.factorId,
    code: parsed.data.code,
  });
  if (error) return { error: "That code didn't work. Codes change every 30 seconds — try the newest one." };
  redirect(safeNext(parsed.data.next));
}
