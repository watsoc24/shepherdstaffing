import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { searchTerm } from "@/lib/validation";

export const metadata = { title: "School directory" };

export default async function SchoolsPage({ searchParams }: PageProps<"/schools">) {
  const sp = await searchParams;
  const q = searchTerm(sp.q);
  const supabase = await createClient();
  let query = supabase
    .from("schools")
    .select("id, name, slug, city, region, country, status")
    .order("name")
    .limit(200);
  if (q) query = query.or(`name.ilike."%${q}%",city.ilike."%${q}%",region.ilike."%${q}%"`);
  const { data: schools } = await query;

  return (
    <div className="space-y-4">
      <h1 className="page-title">Irish dance schools</h1>
      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="School name, city or state" className="input" maxLength={60} aria-label="Search schools" />
        <button className="btn-secondary">Search</button>
      </form>
      {schools?.length ? (
        <ul className="space-y-2">
          {schools.map((s) => (
            <li key={s.id}>
              <Link href={`/schools/${s.slug}`} className="card flex items-center justify-between gap-2">
                <span>
                  <span className="block font-semibold">{s.name}</span>
                  <span className="text-sm text-gray-500">{[s.city, s.region, s.country].filter(Boolean).join(", ")}</span>
                </span>
                {s.status === "verified" ? <span className="badge bg-brand-50 text-brand-700">Verified</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card text-gray-600">No schools found{q ? " for that search" : " yet"}.</p>
      )}
      <p className="text-sm text-gray-600">
        Run a school that isn&apos;t listed?{" "}
        <Link href="/schools/claim" className="link">
          Add and verify your school
        </Link>
      </p>
    </div>
  );
}
