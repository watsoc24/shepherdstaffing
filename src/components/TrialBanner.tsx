import Link from "next/link";
import { Banner } from "./Banner";
import type { ClientEntitlements } from "@/context/AuthContext";

export function TrialBanner({ entitlements }: { entitlements: ClientEntitlements }) {
  if (entitlements.state === "trial" && entitlements.trialEndsAt) {
    const days = Math.max(0, Math.ceil((new Date(entitlements.trialEndsAt).getTime() - Date.now()) / 86_400_000));
    return (
      <Banner tone="info">
        Free trial: {days} day{days === 1 ? "" : "s"} left. You can build your profile and see match scores; contacting
        matches requires a membership. <Link href="/pricing">See plans</Link>
      </Banner>
    );
  }
  if (entitlements.state === "expired") {
    return (
      <Banner tone="warn">
        Your trial or membership has ended. Your profile is safe. <Link href="/pricing">Choose a membership</Link> to see
        matches in full and get in touch.
      </Banner>
    );
  }
  if (entitlements.pastDue) {
    return <Banner tone="warn">We couldn&apos;t process your last payment. Please update your card in <Link href="/dashboard/billing">Billing</Link>.</Banner>;
  }
  return null;
}
