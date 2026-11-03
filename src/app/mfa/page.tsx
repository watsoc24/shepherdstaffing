import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccount, requiresMfa } from "@/lib/auth";
import { safeNext } from "@/lib/safe-redirect";
import { ActionForm } from "@/components/action-form";
import { TextField } from "@/components/fields";
import { verifyTotp } from "./actions";
import { EnrollTotp } from "./enroll";

export const metadata = { title: "Two-step verification" };

export default async function MfaPage({ searchParams }: PageProps<"/mfa">) {
  const account = await getAccount();
  const next = safeNext((await searchParams).next);
  if (!account) redirect(`/login?next=${encodeURIComponent("/mfa")}`);
  if (account.aal === "aal2") redirect(next);

  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp?.find((f) => f.status === "verified");

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="page-title">Two-step verification</h1>
      <div className="card space-y-4">
        {factor ? (
          <>
            <p className="text-sm text-gray-700">Open your authenticator app and enter the current 6-digit code.</p>
            <ActionForm action={verifyTotp} submitLabel="Verify">
              <input type="hidden" name="factorId" value={factor.id} />
              <input type="hidden" name="next" value={next} />
              <TextField label="6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required />
            </ActionForm>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-700">
              {requiresMfa(account)
                ? "School administrator accounts must use two-step verification. This protects your school's listing and the families who rely on it."
                : "Add a second step to your sign-in for extra protection."}
            </p>
            <EnrollTotp next={next} />
          </>
        )}
      </div>
    </div>
  );
}
