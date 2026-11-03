import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { TextField } from "@/components/fields";
import { signOut } from "@/app/auth-actions";
import { deleteAccount, updateDisplayName } from "./actions";

export const metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const account = await requireUser("/account");
  const { notice } = await searchParams;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", account.id).single();

  const links: [string, string][] = [
    ["/account/children", "My dancers (private)"],
    ["/marketplace/mine", "My listings"],
    ["/orders", "Purchases & sales"],
    ["/sell/payouts", "Get paid (seller payouts)"],
    ["/messages", "Messages"],
  ];
  if (account.role === "school_admin") links.push(["/schools/manage", "My school"]);
  if (account.isPlatformAdmin) links.push(["/admin", "Platform admin"]);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Your account</h1>
      {notice === "school-admin-only" ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          That page is for school administrator accounts. Parent accounts can&apos;t claim or manage schools.
        </p>
      ) : null}

      <section className="card">
        <p className="text-sm text-gray-500">Signed in as</p>
        <p className="font-medium break-all">{account.email}</p>
        <p className="mt-1 text-sm text-gray-500">
          {account.role === "school_admin" ? "School administrator" : "Parent / guardian"}
          {account.aal === "aal2" ? " · two-step verification on" : ""}
        </p>
      </section>

      <nav className="card divide-y divide-gray-100 p-0">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="flex min-h-12 items-center justify-between px-4 py-3 font-medium">
            {label} <span aria-hidden>›</span>
          </Link>
        ))}
      </nav>

      <section className="card">
        <h2 className="mb-3 font-semibold">Display name</h2>
        <ActionForm action={updateDisplayName} submitLabel="Save" buttonClassName="btn">
          <TextField
            label="Display name"
            name="displayName"
            defaultValue={profile?.display_name ?? ""}
            required
            maxLength={60}
            hint="Visible to people you message. Never use your child's name."
          />
        </ActionForm>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Security</h2>
        <Link href="/account/password" className="btn-secondary w-full">
          Change password
        </Link>
        {account.aal !== "aal2" ? (
          <Link href="/mfa?next=/account" className="btn-secondary w-full">
            Turn on two-step verification
          </Link>
        ) : null}
        <form action={signOut}>
          <button className="btn-secondary w-full">Sign out</button>
        </form>
      </section>

      <section className="card border-red-200">
        <h2 className="mb-2 font-semibold text-red-700">Delete account</h2>
        <p className="mb-3 text-sm text-gray-600">
          Permanently deletes your profile, dancer profiles, listings, photos and messages. Records of completed
          payments are kept without your name, as required for accounting.
        </p>
        <ActionForm action={deleteAccount} submitLabel="Delete my account" buttonClassName="btn-danger w-full">
          <TextField label='Type "DELETE" to confirm' name="confirm" autoComplete="off" required />
        </ActionForm>
      </section>
    </div>
  );
}
