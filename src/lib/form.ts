import type { z } from "zod";

export type FormState = { ok?: boolean; error?: string; message?: string };

export const initialFormState: FormState = {};

/** Turns zod issues into one readable sentence for the form. */
export function validationError(error: z.ZodError): FormState {
  const first = error.issues.slice(0, 3).map((i) => i.message);
  return { error: first.join(" ") };
}

/** Maps database errors to friendly messages without leaking internals. */
export function dbError(error: { message?: string; code?: string } | null): FormState {
  const msg = error?.message ?? "";
  if (msg.includes("rate_limited")) return { error: "You're sending messages too quickly. Please wait a minute." };
  if (msg.includes("quota_exceeded")) return { error: "You've reached the limit for this for now. Please try again later." };
  if (error?.code === "23505") return { error: "That already exists." };
  if (error?.code === "42501" || msg.includes("row-level security") || msg.includes("permission denied"))
    return { error: "You don't have permission to do that." };
  if (error?.code === "23514") return { error: "Some of the information isn't valid. Please check the form." };
  return { error: "Something went wrong. Please try again." };
}
