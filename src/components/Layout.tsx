import Link from "next/link";
import Head from "next/head";
import type { ReactNode } from "react";
import { BRAND, SUPPORT_EMAIL } from "@/lib/brand";

export function Layout({ title, children, dark = false }: { title?: string; children: ReactNode; dark?: boolean }) {
  const fullTitle = title ? `${title} · ${BRAND}` : BRAND;
  return (
    <>
      <Head>
        <title>{fullTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <a href="#main" className="skip-link">Skip to content</a>
      <div className={dark ? "dark" : undefined}>
        <header className="container site-header">
          <Link href="/" className="brand">{BRAND}</Link>
          <nav aria-label="Main" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/pricing">Pricing</Link>
            <Link href="/login">Sign in</Link>
          </nav>
        </header>
      </div>
      <main id="main">{children}</main>
      <footer className="site-footer">
        <div className="container">
          <nav aria-label="Legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/contact">Contact</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </nav>
          <p>© {new Date().getFullYear()} {BRAND}. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
