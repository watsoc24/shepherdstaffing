export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article className="space-y-4 text-gray-800">
      <h1 className="page-title">Terms of use</h1>
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        Draft — to be reviewed by a qualified lawyer before public launch.
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li>You must be 18 or older to create an account.</li>
        <li>
          Marketplace sales are between members. Sellers are responsible for describing items accurately and shipping
          them. A platform fee of 7% of the amount paid is deducted from each online sale; Stripe&apos;s processing
          fees also apply to the seller.
        </li>
        <li>Item photos must not include people. Listings that break this rule are removed.</li>
        <li>
          Feis information links to organizers&apos; own websites. We don&apos;t process registrations; always confirm
          details with the organizer.
        </li>
        <li>School listings marked “Verified” have been claimed by someone our team confirmed works at the school.</li>
        <li>Harassment, scams, and sharing other people&apos;s personal information are not allowed.</li>
      </ul>
    </article>
  );
}
