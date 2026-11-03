"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Checks for new messages every 15 seconds while the page is visible. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 15_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
