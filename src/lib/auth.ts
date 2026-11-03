import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Account = {
  id: string;
  email: string | null;
  role: "parent" | "school_admin";
  isPlatformAdmin: boolean;
  aal: "aal1" | "aal2";
};

/** The verified current user (or null). Cached per request. */
export const getAccount = cache(async (): Promise<Account | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const { data: roleRow } = await supabase
    .from("account_roles")
    .select("role, is_platform_admin")
    .eq("user_id", claims.sub)
    .maybeSingle();
  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    role: roleRow?.role === "school_admin" ? "school_admin" : "parent",
    isPlatformAdmin: Boolean(roleRow?.is_platform_admin),
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
  };
});

/** True when this account must use two-factor authentication. */
export function requiresMfa(account: Account) {
  return account.role === "school_admin" || account.isPlatformAdmin;
}

/**
 * Requires a signed-in user. School admins and platform admins must also have
 * completed MFA in this session (the proxy redirects them, this double-checks).
 */
export async function requireUser(next = "/account"): Promise<Account> {
  const account = await getAccount();
  if (!account) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (requiresMfa(account) && account.aal !== "aal2") redirect(`/mfa?next=${encodeURIComponent(next)}`);
  return account;
}

export async function requireSchoolAdmin(next: string): Promise<Account> {
  const account = await requireUser(next);
  if (account.role !== "school_admin") redirect("/account?notice=school-admin-only");
  return account;
}

export async function requirePlatformAdmin(): Promise<Account> {
  const account = await requireUser("/admin");
  if (!account.isPlatformAdmin) redirect("/");
  return account;
}
