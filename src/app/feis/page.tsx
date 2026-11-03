import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "@/lib/auth";
import { searchTerm } from "@/lib/validation";

export const metadata = { title: "Feis calendar" };

function formatRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" };
  const s = new Date(`${start}T00:00:00Z`).toLocaleDateString("en", opts);
  if (start === end) return s;
  return `${s} – ${new Date(`${end}T00:00:00Z`).toLocaleDateString("en", opts)}`;
}

export default async function FeisPage({ searchParams }: PageProps<"/feis">) {
  const sp = await searchParams;
  const where = searchTerm(sp.where);
  const account = await getAccount();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("feis_events")
    .select("id, name, starts_on, ends_on, venue_name, city, region, country, registration_url, schools(name, slug)")
    .eq("status", "published")
    .gte("ends_on", today)
    .order("starts_on")
    .limit(200);
  if (where) {
    query = query.or(`city.ilike."%${where}%",region.ilike."%${where}%",country.ilike."%${where}%"`);
  }
  const { data: events } = await query;

  return (
    <div className="space-y-4">
      <h1 className="page-title">Feis calendar</h1>
      {sp.submitted ? (
        <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
          Thanks! Your event will appear once it&apos;s been reviewed.
        </p>
      ) : null}
      <p className="text-sm text-gray-600">
        Registration happens on each organizer&apos;s own site. Always check dates and details there — they can
        change.
      </p>
      <form className="flex gap-2" role="search">
        <input name="where" defaultValue={where} placeholder="City, state or country" className="input" maxLength={60} aria-label="Filter by place" />
        <button className="btn-secondary">Filter</button>
      </form>

      {events?.length ? (
        <ul className="space-y-3">
          {events.map((e) => {
            const host = e.schools as unknown as { name: string; slug: string } | null;
            return (
              <li key={e.id} className="card space-y-1">
                <p className="text-sm font-semibold text-brand-700">{formatRange(e.starts_on, e.ends_on)}</p>
                <p className="text-lg font-semibold">{e.name}</p>
                <p className="text-sm text-gray-600">
                  {[e.venue_name, e.city, e.region, e.country].filter(Boolean).join(", ")}
                </p>
                {host ? (
                  <p className="text-sm text-gray-500">
                    Hosted by{" "}
                    <Link href={`/schools/${host.slug}`} className="link">
                      {host.name}
                    </Link>
                  </p>
                ) : null}
                <a href={e.registration_url} target="_blank" rel="noopener noreferrer nofollow" className="btn-secondary mt-2 w-full">
                  Register on organizer&apos;s site ↗
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="card text-gray-600">
          No upcoming feiseanna are listed{where ? " for that location" : ""} yet. School administrators can submit
          events for review.
        </p>
      )}
      {account?.role === "school_admin" ? (
        <Link href="/feis/submit" className="btn w-full">
          Submit a feis
        </Link>
      ) : null}
    </div>
  );
}
