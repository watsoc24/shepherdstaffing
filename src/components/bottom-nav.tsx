"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/feis", label: "Feiseanna" },
  { href: "/schools", label: "Schools" },
  { href: "/marketplace", label: "Market" },
  { href: "/messages", label: "Messages", auth: true },
  { href: "/account", label: "Account", auth: true },
];

/** Thumb-friendly tab bar for phones (hidden on wider screens). */
export function BottomNav({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  const visible = items.filter((i) => !i.auth || signedIn);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
      <ul className="flex">
        {visible.map((i) => {
          const active = path === i.href || path.startsWith(`${i.href}/`);
          return (
            <li key={i.href} className="flex-1">
              <Link
                href={i.href}
                className={`flex min-h-14 items-center justify-center text-xs font-semibold ${active ? "text-brand-700" : "text-gray-500"}`}
                aria-current={active ? "page" : undefined}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
