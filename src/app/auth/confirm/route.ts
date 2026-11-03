import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";

const OTP_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "email_change", "invite", "magiclink"];

/** Handles links from confirmation / password-reset emails. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const supabase = await createClient();

  let ok = false;
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const origin = request.nextUrl.origin;
  const url = ok ? new URL(next, origin) : new URL("/login?notice=link-expired", origin);
  return NextResponse.redirect(url);
}
