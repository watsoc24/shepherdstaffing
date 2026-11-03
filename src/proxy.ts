import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { buildCsp } from "@/lib/csp";

// Pages that require a signed-in account.
const PROTECTED = ["/account", "/marketplace", "/messages", "/orders", "/sell", "/schools/claim", "/schools/manage", "/feis/submit", "/admin"];
// Pages a signed-in user may visit before finishing MFA.
const MFA_EXEMPT = ["/mfa", "/auth", "/login", "/signup"];

const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const { supabase, claims, getResponse } = await updateSession(request, requestHeaders);
  const path = request.nextUrl.pathname;

  const withHeaders = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp);
    // Carry over any refreshed auth cookies.
    getResponse().cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };
  const redirectTo = (pathname: string, next?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = next ? `?next=${encodeURIComponent(next)}` : "";
    return withHeaders(NextResponse.redirect(url));
  };

  const isProtected = startsWithAny(path, PROTECTED);
  if (!claims?.sub) {
    if (isProtected || path.startsWith("/mfa")) return redirectTo("/login", path + request.nextUrl.search);
    return withHeaders(getResponse());
  }

  // Signed in: enforce MFA where required.
  if (!startsWithAny(path, MFA_EXEMPT)) {
    const aal = claims.aal === "aal2" ? "aal2" : "aal1";
    if (aal !== "aal2") {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const hasFactor = aalData?.nextLevel === "aal2";
      if (hasFactor) {
        // Anyone who has set up MFA must complete it to use protected pages.
        if (isProtected) return redirectTo("/mfa", path);
      } else {
        const { data: role } = await supabase
          .from("account_roles")
          .select("role, is_platform_admin")
          .eq("user_id", claims.sub)
          .maybeSingle();
        const mustUseMfa = role?.role === "school_admin" || role?.is_platform_admin;
        if (mustUseMfa && isProtected) return redirectTo("/mfa", path);
      }
    }
  }

  return withHeaders(getResponse());
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
