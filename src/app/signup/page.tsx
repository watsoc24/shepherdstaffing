import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Checkbox, TextField } from "@/components/fields";
import { signUp } from "@/app/auth-actions";

export const metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="page-title">Create an account</h1>
      <p className="mb-4 text-sm text-gray-600">
        Accounts are for parents, guardians and school staff aged 18 or over. Dancers don&apos;t get their own
        accounts — parents add them privately.
      </p>
      <div className="card">
        <ActionForm action={signUp} submitLabel="Create account" pendingLabel="Creating…">
          <TextField
            label="Display name"
            name="displayName"
            required
            maxLength={60}
            autoComplete="nickname"
            hint="Shown to people you message. Use your own first name or a nickname — never your child's name."
          />
          <TextField label="Email" name="email" type="email" required maxLength={254} autoComplete="email" />
          <TextField
            label="Password"
            name="password"
            type="password"
            required
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            hint="At least 10 characters. A passphrase is easiest."
          />
          <fieldset>
            <legend className="label">Account type</legend>
            <div className="space-y-2">
              <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3">
                <input type="radio" name="role" value="parent" defaultChecked className="mt-1 h-5 w-5 accent-brand-600" />
                <span>
                  <span className="font-medium">Parent or guardian</span>
                  <span className="block text-sm text-gray-500">Buy and sell gear, follow feiseanna, find schools.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3">
                <input type="radio" name="role" value="school_admin" className="mt-1 h-5 w-5 accent-brand-600" />
                <span>
                  <span className="font-medium">School administrator</span>
                  <span className="block text-sm text-gray-500">
                    Claim and manage your school&apos;s listing. Requires an authenticator app (two-step verification).
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
          <Checkbox name="adult" required label="I am 18 or older and a parent/guardian or school staff member." />
          <Checkbox
            name="terms"
            required
            label={
              <>
                I agree to the{" "}
                <Link href="/terms" className="link">
                  terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="link">
                  privacy notice
                </Link>
                .
              </>
            }
          />
        </ActionForm>
      </div>
      <p className="mt-4 text-sm">
        Already have an account?{" "}
        <Link href="/login" className="link">
          Sign in
        </Link>
      </p>
    </div>
  );
}
