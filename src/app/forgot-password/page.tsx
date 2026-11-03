import { ActionForm } from "@/components/action-form";
import { TextField } from "@/components/fields";
import { requestPasswordReset } from "@/app/auth-actions";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="page-title">Reset your password</h1>
      <div className="card">
        <ActionForm action={requestPasswordReset} submitLabel="Send reset link">
          <TextField label="Email" name="email" type="email" required maxLength={254} autoComplete="email" />
        </ActionForm>
      </div>
    </div>
  );
}
