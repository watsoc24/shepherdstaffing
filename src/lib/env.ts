import "server-only";

// Server-only configuration. Nothing here is ever sent to the browser:
// none of these variables use the NEXT_PUBLIC_ prefix.
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("SUPABASE_URL");
  },
  get supabasePublishableKey() {
    return required("SUPABASE_PUBLISHABLE_KEY");
  },
  get supabaseSecretKey() {
    return required("SUPABASE_SECRET_KEY");
  },
  get stripeSecretKey() {
    return required("STRIPE_SECRET_KEY");
  },
  get stripeWebhookSecret() {
    return required("STRIPE_WEBHOOK_SECRET");
  },
  get siteUrl() {
    return required("SITE_URL").replace(/\/$/, "");
  },
  get stripeConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  },
};
