"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { rateLimit, RATE_LIMITED } from "@/lib/rate-limit";
import { validationError, type FormState } from "@/lib/form";
import { emailOnlySchema, formObject, loginSchema, newPasswordSchema, signUpSchema } from "@/lib/validation";
import { safeNext } from "@/lib/safe-redirect";
import { getAccount, requiresMfa } from "@/lib/auth";

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  if (!(await rateLimit("signup", 5, 3600))) return RATE_LIMITED;

  const { displayName, email, password, role } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${env.siteUrl}/auth/confirm?next=/account`,
      data: { display_name: displayName, role },
    },
  });
  if (error) {
    if (error.code === "weak_password") return { error: "Please choose a stronger password." };
    if (error.status === 429) return RATE_LIMITED;
    console.error("signup error", error.code);
    return { error: "We couldn't create your account. Please try again." };
  }
  // Same message whether or not the email already exists (prevents account discovery).
  return { ok: true, message: "Check your email for a link to confirm your account." };
}

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const raw = formObject(formData);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { error: "Enter your email and password." };
  const { email, password } = parsed.data;
  if (!(await rateLimit("login-ip", 20, 900)) || !(await rateLimit("login-email", 10, 900, email))) {
    return RATE_LIMITED;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Please confirm your email first. Check your inbox for the link." };
    }
    return { error: "Incorrect email or password." };
  }

  const next = safeNext(raw.next);
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect(`/mfa?next=${encodeURIComponent(next)}`);
  const account = await getAccount();
  if (account && requiresMfa(account)) redirect(`/mfa?next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailOnlySchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  if (!(await rateLimit("reset-ip", 5, 3600)) || !(await rateLimit("reset-email", 3, 3600, parsed.data.email))) {
    return RATE_LIMITED;
  }
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl}/auth/confirm?next=/account/password`,
  });
  return { ok: true, message: "If an account exists for that email, we've sent a reset link." };
}

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  const account = await getAccount();
  if (!account) redirect("/login");
  const parsed = newPasswordSchema.safeParse(formObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  if (!(await rateLimit("password-change", 5, 3600, account.id))) return RATE_LIMITED;
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { error: "Choose a password you haven't used here before." };
    if (error.code === "weak_password") return { error: "Please choose a stronger password." };
    if (error.code === "insufficient_aal") return { error: "Please complete two-step verification first." };
    return { error: "Couldn't update your password. Please sign in again and retry." };
  }
  return { ok: true, message: "Password updated." };
}
