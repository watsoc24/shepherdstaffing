import { z } from "zod";
import { COUNTRIES, MAX_SHIPPING_CENTS, MIN_PRICE_CENTS, MAX_PRICE_CENTS, parseMoneyToCents } from "@/lib/money";

// Strips control characters (keeps newlines/tabs) and trims.
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
const text = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .transform(clean)
    .pipe(
      z
        .string()
        .min(min, { error: min <= 1 ? `${label} is required.` : `${label} must be at least ${min} characters.` })
        .max(max, { error: `${label} must be at most ${max} characters.` }),
    );
const optionalText = (label: string, max: number) =>
  z
    .string()
    .optional()
    .transform((s) => (s ? clean(s) : ""))
    .pipe(z.string().max(max, { error: `${label} must be at most ${max} characters.` }))
    .transform((s) => (s === "" ? null : s));
const httpsUrl = (label: string) =>
  z
    .string()
    .transform(clean)
    .pipe(
      z
        .url({ protocol: /^https$/, error: `${label} must be a full https:// link.` })
        .max(300, { error: `${label} is too long.` }),
    );
const optionalHttpsUrl = (label: string) =>
  z
    .string()
    .optional()
    .transform((s) => (s ? clean(s) : ""))
    .pipe(z.union([z.literal(""), httpsUrl(label)]))
    .transform((s) => (s === "" ? null : s));
const email = z
  .string()
  .transform(clean)
  .pipe(z.email({ error: "Enter a valid email address." }).max(254));
const uuid = z.uuid({ error: "Invalid reference." });
const optionalUuid = z
  .string()
  .optional()
  .transform((s) => (s ? s : null))
  .pipe(z.uuid().nullable());
const countryCode = z.enum(COUNTRIES.map((c) => c.code) as [string, ...string[]], { error: "Choose a country." });

export const password = z
  .string()
  .min(10, { error: "Password must be at least 10 characters." })
  .max(128, { error: "Password is too long." });

export const signUpSchema = z.object({
  displayName: text("Display name", 1, 60),
  email,
  password,
  role: z.enum(["parent", "school_admin"], { error: "Choose an account type." }),
  adult: z.literal("yes", { error: "You must confirm you are 18 or older." }),
  terms: z.literal("yes", { error: "You must agree to the terms and privacy notice." }),
});

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const emailOnlySchema = z.object({ email });
export const newPasswordSchema = z.object({ password });
export const displayNameSchema = z.object({ displayName: text("Display name", 1, 60) });

const currentYear = new Date().getFullYear();
export const DANCE_LEVELS = [
  ["beginner", "Beginner"],
  ["advanced_beginner", "Advanced beginner"],
  ["novice", "Novice"],
  ["prizewinner", "Prizewinner"],
  ["preliminary_championship", "Preliminary championship"],
  ["open_championship", "Open championship"],
  ["adult", "Adult"],
  ["other", "Other"],
] as const;

export const childSchema = z.object({
  nickname: text("Nickname", 1, 40),
  birthYear: z
    .string()
    .optional()
    .transform((s) => (s ? Number(s) : null))
    .pipe(z.number().int().min(currentYear - 30).max(currentYear).nullable()),
  danceLevel: z
    .string()
    .optional()
    .transform((s) => (s ? s : null))
    .pipe(z.enum(DANCE_LEVELS.map(([v]) => v) as [string, ...string[]]).nullable()),
  schoolId: optionalUuid,
});

export const CATEGORIES = [
  ["solo_dress", "Solo dress"],
  ["school_costume", "School costume"],
  ["hard_shoes", "Hard shoes"],
  ["soft_shoes", "Soft shoes (ghillies / reels)"],
  ["wig", "Wig / hairpiece"],
  ["accessories", "Accessories"],
  ["other", "Other"],
] as const;
export const CONDITIONS = [
  ["new", "New"],
  ["like_new", "Like new"],
  ["good", "Good"],
  ["fair", "Fair"],
] as const;
export const categoryLabel = (v: string) => CATEGORIES.find(([k]) => k === v)?.[1] ?? v;
export const conditionLabel = (v: string) => CONDITIONS.find(([k]) => k === v)?.[1] ?? v;
export const levelLabel = (v: string | null) => DANCE_LEVELS.find(([k]) => k === v)?.[1] ?? "—";

const money = (label: string, min: number, max: number) =>
  z
    .string()
    .transform((s, ctx) => {
      const cents = parseMoneyToCents(s || "0");
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: `${label} must be a number like 120 or 120.50.` });
        return z.NEVER;
      }
      return cents;
    })
    .pipe(
      z
        .number()
        .min(min, { error: `${label} must be at least ${(min / 100).toFixed(2)}.` })
        .max(max, { error: `${label} must be at most ${(max / 100).toFixed(2)}.` }),
    );

export const listingSchema = z.object({
  title: text("Title", 3, 100),
  description: optionalText("Description", 2000).transform((s) => s ?? ""),
  category: z.enum(CATEGORIES.map(([v]) => v) as [string, ...string[]], { error: "Choose a category." }),
  size_label: text("Size", 1, 40),
  price: money("Price", MIN_PRICE_CENTS, MAX_PRICE_CENTS),
  shipping: money("Shipping", 0, MAX_SHIPPING_CENTS),
  condition: z.enum(CONDITIONS.map(([v]) => v) as [string, ...string[]], { error: "Choose a condition." }),
  city: text("City", 1, 80),
  region: text("State / region", 1, 80),
  country: countryCode,
});

export const listingStatusSchema = z.object({ status: z.enum(["active", "sold", "removed"]) });

export const messageSchema = z.object({ body: text("Message", 1, 2000) });

export const claimSchema = z
  .object({
    schoolId: optionalUuid,
    proposedName: optionalText("School name", 120),
    proposedCity: optionalText("City", 80),
    proposedRegion: optionalText("State / region", 80),
    proposedCountry: optionalText("Country", 56),
    proposedWebsite: optionalHttpsUrl("Website"),
    claimantTitle: text("Your role at the school", 2, 80),
    contactEmail: email,
    evidence: text("How we can verify you", 10, 1000),
  })
  .refine((v) => v.schoolId || (v.proposedName && v.proposedName.length >= 2), {
    error: "Enter the school's name.",
  });

export const schoolEditSchema = z.object({
  city: optionalText("City", 80),
  region: optionalText("State / region", 80),
  country: optionalText("Country", 56),
  websiteUrl: optionalHttpsUrl("Website"),
  publicEmail: z
    .string()
    .optional()
    .transform((s) => (s ? clean(s) : ""))
    .pipe(z.union([z.literal(""), z.email({ error: "Enter a valid public email." }).max(254)]))
    .transform((s) => (s === "" ? null : s)),
  description: optionalText("Description", 2000),
});

export const adminSchoolSchema = schoolEditSchema.extend({ name: text("Name", 2, 120) });

const isoDate = z.iso.date({ error: "Enter a valid date." });
export const feisSchema = z
  .object({
    name: text("Event name", 3, 150),
    startsOn: isoDate,
    endsOn: isoDate,
    venueName: optionalText("Venue", 150),
    city: text("City", 1, 80),
    region: optionalText("State / region", 80),
    country: text("Country", 2, 56),
    registrationUrl: httpsUrl("Registration link"),
    hostSchoolId: optionalUuid,
  })
  .refine((v) => v.endsOn >= v.startsOn, { error: "End date must be on or after the start date." })
  .refine((v) => (Date.parse(v.endsOn) - Date.parse(v.startsOn)) / 86_400_000 <= 14, {
    error: "Events can be at most 14 days long.",
  });

export const reportSchema = z.object({
  targetType: z.enum(["listing", "message", "school", "feis_event"]),
  targetId: uuid,
  reason: text("Reason", 5, 1000),
});

export const reviewNoteSchema = optionalText("Note", 500);

export { uuid as uuidSchema };

/** Reads a FormData into a plain object of strings (files are ignored). */
export function formObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}

/** Search text is limited to letters, digits, spaces, hyphens and apostrophes so it can't alter query filters. */
export function searchTerm(input: unknown, max = 60): string {
  if (typeof input !== "string") return "";
  return input.normalize("NFKC").replace(/[^\p{L}\p{N} '\-]/gu, "").replace(/\s+/g, " ").trim().slice(0, max);
}
