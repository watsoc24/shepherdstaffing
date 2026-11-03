import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

async function clientIp(): Promise<string> {
  const h = await headers();
  // On Vercel, x-real-ip / x-forwarded-for are set by the platform edge.
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

/**
 * Returns true if the action is allowed. Keys are hashed so raw IPs/emails
 * are never stored. Fails closed (blocks) if the limiter itself errors.
 */
export async function rateLimit(
  action: string,
  max: number,
  windowSeconds: number,
  identity?: string,
): Promise<boolean> {
  const subject = identity ? `id:${identity.toLowerCase()}` : `ip:${await clientIp()}`;
  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_key: `${action}:${hash(subject)}`,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limiter error", error.code);
    return false;
  }
  return data === true;
}

export const RATE_LIMITED = { error: "Too many attempts. Please wait a few minutes and try again." };
