import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { TextField } from "@/components/fields";
import { signIn } from "@/app/auth-actions";
import { safeNext } from "@/lib/safe-redirect";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, notice } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="page-title">Sign in</h1>
      {notice === "link-expired" ? (
        <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          That email link has expired or was already used. Sign in, or request a new link.
        </p>
      ) : null}
      <div className="card">
        <ActionForm action={signIn} submitLabel="Sign in" pendingLabel="Signing in…">
          <input type="hidden" name="next" value={safeNext(next)} />
          <TextField label="Email" name="email" type="email" autoComplete="email" required maxLength={254} />
          <TextField label="Password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
        </ActionForm>
      </div>
      <p className="mt-4 text-sm">
        <Link href="/forgot-password" className="link">
          Forgot password?
        </Link>
      </p>
      <p className="mt-2 text-sm">
        New here?{" "}
        <Link href="/signup" className="link">
          Create an account
        </Link>
      </p>
    </div>
  );
}
