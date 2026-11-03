"use client";

import { useActionState, type ReactNode } from "react";
import type { FormState } from "@/lib/form";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel?: string;
  children?: ReactNode;
  className?: string;
  buttonClassName?: string;
  resetOnSuccess?: boolean;
};

/** A form wired to a server action that shows errors/success inline. */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel = "Working…",
  children,
  className = "space-y-4",
  buttonClassName = "btn w-full",
}: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
          {state.message}
        </p>
      ) : null}
      <button type="submit" className={buttonClassName} disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
