import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getAccount } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";

export const metadata: Metadata = {
  title: { default: "Irish Dance Connect", template: "%s · Irish Dance Connect" },
  description: "Feis calendar, school directory and a dress & gear marketplace for Irish dance families.",
  applicationName: "Irish Dance Connect",
  appleWebApp: { capable: true, title: "Dance Connect", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0b7a45",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const account = await getAccount();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold text-brand-700">
              Irish Dance Connect
            </Link>
            <nav className="hidden gap-4 text-sm font-medium sm:flex">
              <Link href="/feis">Feis calendar</Link>
              <Link href="/schools">Schools</Link>
              <Link href="/marketplace">Marketplace</Link>
              {account ? <Link href="/messages">Messages</Link> : null}
              {account?.isPlatformAdmin ? <Link href="/admin">Admin</Link> : null}
            </nav>
            {account ? (
              <Link href="/account" className="text-sm font-semibold text-brand-700">
                Account
              </Link>
            ) : (
              <Link href="/login" className="text-sm font-semibold text-brand-700">
                Sign in
              </Link>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28 sm:pb-10">{children}</main>
        <footer className="mx-auto mb-24 w-full max-w-3xl px-4 py-6 text-sm text-gray-500 sm:mb-0">
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/safety">Safety</Link>
          </div>
        </footer>
        <BottomNav signedIn={Boolean(account)} />
      </body>
    </html>
  );
}
