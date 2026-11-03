import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Privileged client that BYPASSES row-level security.
 * Use only for: rate limiting, Stripe webhook/checkout bookkeeping and account deletion.
 * Never use it to read data on behalf of a user.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
