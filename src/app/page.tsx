import Link from "next/link";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { notice } = await searchParams;
  const sections = [
    {
      href: "/feis",
      title: "Feis calendar",
      body: "Upcoming feiseanna in one place, with a direct link to each organizer's official registration page.",
    },
    {
      href: "/marketplace",
      title: "Dress & gear marketplace",
      body: "Buy and sell solo dresses, shoes, wigs and more with other dance families. Secure checkout through Stripe.",
    },
    {
      href: "/schools",
      title: "School directory",
      body: "Find Irish dance schools near you. Verified badges mean the school itself has confirmed its listing.",
    },
  ];
  return (
    <div className="space-y-6">
      {notice === "account-deleted" ? (
        <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
          Your account and its data have been deleted.
        </p>
      ) : null}
      <section className="rounded-3xl bg-brand-700 p-6 text-white">
        <h1 className="text-3xl font-bold">The Irish dance world, in one place</h1>
        <p className="mt-2 text-white/90">
          For dance parents and schools: find feiseanna, find schools, and pass on dresses and gear your dancer has
          outgrown.
        </p>
        <div className="mt-4 flex gap-2">
          <Link href="/signup" className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 font-semibold text-brand-700">
            Create free account
          </Link>
          <Link href="/feis" className="inline-flex min-h-11 items-center rounded-xl border border-white/60 px-4 font-semibold">
            Browse feiseanna
          </Link>
        </div>
      </section>
      <ul className="space-y-3">
        {sections.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="card block">
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <p className="text-gray-600">{s.body}</p>
            </Link>
          </li>
        ))}
      </ul>
      <section className="card text-sm text-gray-700">
        <h2 className="mb-1 font-semibold">Built with dancers&apos; privacy in mind</h2>
        <p>
          Only parents and school staff have accounts. Dancer details stay private to their parent, and we never
          show children&apos;s names or photos publicly.
        </p>
      </section>
    </div>
  );
}
