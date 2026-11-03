/** Builds the Content-Security-Policy header for a page response. */
export function buildCsp(nonce: string, isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Next.js and React inject a few inline styles; they carry the nonce in prod.
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    // Listing photos are served via short-lived signed URLs from Supabase Storage.
    `img-src 'self' data: blob: ${process.env.SUPABASE_URL ?? ""}`.trim(),
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // Server actions redirect to Stripe Checkout / Stripe onboarding.
    "form-action 'self' https://checkout.stripe.com https://connect.stripe.com",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}
