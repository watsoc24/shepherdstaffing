import { z } from "zod";

// C0/C1 control characters except tab, newline, carriage return.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

export const stripControlChars = (v: string) => v.replace(CONTROL, "");
export const normalizeEmail = (v: string) => stripControlChars(v).trim().toLowerCase();

/** Trimmed, control-char-free text with a max length. Spec: profile text ≤ 5,000, messages ≤ 2,000. */
export const text = (max: number) => z.string().transform((v) => stripControlChars(v).trim()).pipe(z.string().max(max));
export const shortText = text(200);
export const profileText = text(5000);
export const messageText = text(2000).pipe(z.string().min(1, "Message cannot be empty"));
export const emailField = z.string().max(254).transform(normalizeEmail).pipe(z.email("Enter a valid email address"));

/** Optional text that turns "" into null so clearing a field works. */
export const nullableText = (max: number) =>
  text(max).transform((v) => (v === "" ? null : v)).nullable().optional();
