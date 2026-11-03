export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="space-y-4 text-gray-800">
      <h1 className="page-title">Privacy notice</h1>
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        Draft — to be reviewed by a qualified lawyer before public launch. It describes how the app is built today.
      </p>
      <h2 className="font-semibold">Who can have an account</h2>
      <p>Accounts are for adults (18+): parents/guardians and dance school staff. Children cannot create accounts.</p>
      <h2 className="font-semibold">What we collect</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Your email, password (stored hashed by our authentication provider) and a display name you choose.</li>
        <li>
          Optional dancer profiles you add: a nickname, birth year, level and school. These are visible only to you.
          We do not collect dancers&apos; photos, full names, or contact details.
        </li>
        <li>Marketplace listings, photos of items, and messages you exchange with other members.</li>
        <li>Order records (item, amount, status). Card and bank details are handled by Stripe, not us.</li>
        <li>Short-lived, hashed network identifiers used only to prevent abuse (rate limiting).</li>
      </ul>
      <h2 className="font-semibold">Who can see what</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>The feis calendar and school directory are public.</li>
        <li>Listings and item photos are visible to signed-in members only.</li>
        <li>Messages are visible only to the two people in the conversation.</li>
        <li>Dancer profiles are visible only to the parent who created them.</li>
      </ul>
      <h2 className="font-semibold">Photos</h2>
      <p>Item photos must not show people. Hidden metadata such as GPS location is removed from every uploaded photo.</p>
      <h2 className="font-semibold">Deleting your data</h2>
      <p>
        You can delete your account at any time from your Account page. This removes your profile, dancer profiles,
        listings, photos and messages. Order records are kept without your name where required for accounting.
      </p>
      <h2 className="font-semibold">Service providers</h2>
      <p>We use Supabase (database, login, file storage), Stripe (payments) and our hosting provider to run the service.</p>
    </article>
  );
}
