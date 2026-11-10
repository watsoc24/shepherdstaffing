# Decisions log

Decisions made against the build spec (Section 13 and deviations), with date and reason.

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | 2026-11-03 | **Postgres (Supabase) instead of Airtable for v1.** Accessed only through `src/lib/db/*` via Prisma. | Owner approved. Airtable has no row-level security, ~5 req/s limit, and a single whole-base token. Postgres gives transactions, unique constraints and parameterized queries (removes the formula-injection class entirely). |
| 2 | 2026-11-03 | **Current Next.js (16) with Pages Router**, not 14. | Owner approved. 14 is two majors behind and was affected by CVE-2025-29927 (middleware auth bypass). |
| 3 | 2026-11-03 | Production build uses webpack (`next build --webpack`). | Turbopack's Pages Router output injects an inline bootstrap script, which would force `'unsafe-inline'` in `script-src`. With webpack the CSP is `script-src 'self'` with no exceptions (verified in a browser). |
| 4 | 2026-11-03 | `style-src 'unsafe-inline'` remains. | React `style` props and next/font CSS need it. Inline styles cannot execute script; `script-src` stays strict. Documented per spec defect #14. |
| 5 | 2026-11-03 | Brand "Shepherd Staffing" and support@shepherdstaffing.com are **placeholders** (`src/lib/brand.ts`). | Owner to confirm legal entity name and support email before launch (spec §13 #2). |
| 6 | 2026-11-03 | Stripe Checkout/Portal are full-page redirects; no Stripe.js. | Removes all Stripe origins from the CSP. |
| 7 | 2026-11-03 | Passwords capped at 72 bytes. | bcrypt (spec-mandated) silently ignores bytes past 72; rejecting is safer than truncating. |
| 8 | 2026-11-03 | Signup with an existing email returns the normal "check your email" response and emails the account owner instead. | Stops the signup form being used to discover who has an account. |
| 9 | 2026-11-03 | `past_due` keeps paid access (with a banner) while Stripe retries the card; `cancelled` = expired. | Avoids locking out paying churches over a single failed charge. Change in `computeEntitlements` if you prefer immediate lockout. |
| 10 | 2026-11-03 | Client IP header configurable (`CLIENT_IP_HEADER`). Default `x-real-ip` (set by Vercel). | Once Cloudflare proxies the domain, set it to `cf-connecting-ip`, or per-IP rate limits would see Cloudflare's IPs. |
| 11 | 2026-11-03 | Breached-password check (HIBP k-anonymity) is on by default, fail-open; `HIBP_CHECK=false` disables. | Only 5 hex chars of a SHA-1 leave the server; outages never block signup. |
