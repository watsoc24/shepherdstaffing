import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { levelLabel } from "@/lib/validation";

export const metadata = { title: "My dancers" };

export default async function ChildrenPage() {
  await requireUser("/account/children");
  const supabase = await createClient();
  const { data: children } = await supabase
    .from("children")
    .select("id, nickname, birth_year, dance_level, schools(name)")
    .order("created_at");

  return (
    <div className="space-y-4">
      <h1 className="page-title">My dancers</h1>
      <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
        Dancer profiles are private to your account. They are never shown publicly, to schools, or to other
        members. We don&apos;t collect photos of dancers.
      </p>
      {children?.length ? (
        <ul className="space-y-3">
          {children.map((c) => (
            <li key={c.id}>
              <Link href={`/account/children/${c.id}`} className="card block">
                <p className="font-semibold">{c.nickname}</p>
                <p className="text-sm text-gray-500">
                  {[c.birth_year ? `Born ${c.birth_year}` : null, c.dance_level ? levelLabel(c.dance_level) : null, (c.schools as unknown as { name: string } | null)?.name]
                    .filter(Boolean)
                    .join(" · ") || "No details added"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-600">You haven&apos;t added any dancers yet.</p>
      )}
      <Link href="/account/children/new" className="btn w-full">
        Add a dancer
      </Link>
    </div>
  );
}
