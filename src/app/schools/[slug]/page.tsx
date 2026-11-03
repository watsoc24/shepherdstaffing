import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "School" };

export default async function SchoolPage({ params }: PageProps<"/schools/[slug]">) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,140}$/.test(slug)) notFound();
  const supabase = await createClient();
  const { data: school } = await supabase.from("schools").select("*").eq("slug", slug).maybeSingle();
  if (!school) notFound();
  const today = new Date().toISOString().slice(0, 10);
  const { data: events } = await supabase
    .from("feis_events")
    .select("id, name, starts_on, registration_url")
    .eq("host_school_id", school.id)
    .eq("status", "published")
    .gte("ends_on", today)
    .order("starts_on")
    .limit(20);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{school.name}</h1>
        <p className="text-gray-600">{[school.city, school.region, school.country].filter(Boolean).join(", ")}</p>
        {school.status === "verified" ? (
          <span className="badge mt-2 bg-brand-50 text-brand-700">Verified by the school</span>
        ) : (
          <span className="badge mt-2">Not yet claimed</span>
        )}
      </div>
      {school.description ? <p className="whitespace-pre-line">{school.description}</p> : null}
      <div className="card space-y-2 text-sm">
        {school.website_url ? (
          <p>
            Website:{" "}
            <a href={school.website_url} target="_blank" rel="noopener noreferrer nofollow" className="link break-all">
              {school.website_url}
            </a>
          </p>
        ) : null}
        {school.public_email ? (
          <p>
            Email:{" "}
            <a href={`mailto:${school.public_email}`} className="link break-all">
              {school.public_email}
            </a>
          </p>
        ) : null}
        {!school.website_url && !school.public_email ? <p className="text-gray-500">No contact details added yet.</p> : null}
      </div>
      {events?.length ? (
        <section>
          <h2 className="mb-2 font-semibold">Upcoming feiseanna hosted</h2>
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="card text-sm">
                <span className="font-medium">{e.name}</span> · {e.starts_on}{" "}
                <a href={e.registration_url} target="_blank" rel="noopener noreferrer nofollow" className="link">
                  Register ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {school.status !== "verified" ? (
        <Link href={`/schools/claim?school=${school.id}`} className="btn-secondary w-full">
          Is this your school? Claim it
        </Link>
      ) : null}
    </div>
  );
}
