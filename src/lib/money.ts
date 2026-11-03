/** Platform fee: 7% of the amount the buyer pays (item + shipping). */
export const PLATFORM_FEE_BPS = 700;
/** Minimum item price. Below ~$10 the 7% fee doesn't cover typical card costs. */
export const MIN_PRICE_CENTS = 1000;
export const MAX_PRICE_CENTS = 500000;
export const MAX_SHIPPING_CENTS = 10000;

export function platformFeeCents(totalCents: number): number {
  if (!Number.isInteger(totalCents) || totalCents <= 0) throw new Error("Invalid amount");
  return Math.round((totalCents * PLATFORM_FEE_BPS) / 10_000);
}

export const COUNTRIES = [
  { code: "US", name: "United States", currency: "usd" },
  { code: "CA", name: "Canada", currency: "cad" },
  { code: "GB", name: "United Kingdom", currency: "gbp" },
  { code: "IE", name: "Ireland", currency: "eur" },
  { code: "AU", name: "Australia", currency: "aud" },
  { code: "NZ", name: "New Zealand", currency: "nzd" },
] as const;
export type CountryCode = (typeof COUNTRIES)[number]["code"];

export function currencyFor(country: string): string {
  return COUNTRIES.find((c) => c.code === country)?.currency ?? "usd";
}

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

/** Parses "12.50" style input into integer cents. Returns null if invalid. */
export function parseMoneyToCents(input: string): number | null {
  const s = input.trim().replace(/^[$€£]/, "");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}
