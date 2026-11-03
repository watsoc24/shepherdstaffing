import { ActionForm } from "@/components/action-form";
import { TextField } from "@/components/fields";
import { updatePassword } from "@/app/auth-actions";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Change password" };

export default async function PasswordPage() {
  await requireUser("/account/password");
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="page-title">Set a new password</h1>
      <div className="card">
        <ActionForm action={updatePassword} submitLabel="Save password">
          <TextField
            label="New password"
            name="password"
            type="password"
            required
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
          />
        </ActionForm>
      </div>
    </div>
  );
}
