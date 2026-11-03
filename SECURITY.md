# Security — Irish Dance Connect (Phase 1)

## Controls in place

| Requirement | How it's met |
|---|---|
| RLS on every table | All 14 `public` tables have RLS enabled, with explicit least-privilege grants (column-level where users may edit only some fields). A test fails if any table lacks RLS. |
| Proof users can't read each other's data | `tests/rls/rls.test.ts` (55 tests) runs real queries as different users against the real migration: children, messages, orders, payout accounts, claims, reports, storage objects. Runs in CI on every push. |
| Minors | Parent-only accounts with an 18+ attestation. Dancer profiles are visible only to their parent (not even admins). No child photos are collected. Listing photos must be item-only (attestation + reporting), and EXIF/GPS is stripped server-side. Listings and photos are visible only to signed-in members. |
| MFA for school admins | Enforced at three layers: the proxy redirect, `requireUser()` on every protected page and server action, and RLS (`aal2` required for school edits, claims, feis submissions and platform-admin powers). Parents who opt in to MFA are held to it too. |
| Secrets | No `NEXT_PUBLIC_` variables; the browser never talks to Supabase or Stripe directly. `.env*` is git-ignored (only `.env.example` is committed). The secret key is used only for rate limiting, Stripe bookkeeping and account deletion. |
| Rate limiting | Login, signup, password reset, MFA, checkout, listings, claims and reports are limited per IP and/or account (Postgres-backed). Messages are limited in the database itself (10/min, 200/day), so calling the API directly can't bypass it. |
| Input validation | zod schemas on every form, plus database CHECK constraints (lengths, https-only URLs, price bounds). Search text is restricted to letters, numbers, spaces and hyphens before reaching query filters. |
| CSP & headers | Per-request nonce CSP with `strict-dynamic` and no `unsafe-inline` scripts, plus `frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy and Permissions-Policy. API routes get `default-src 'none'`. |
| Payments | Prices come from the database, never the browser. The webhook is signature-verified and idempotent. An order is marked paid only for the exact checkout session created. A double-sale is auto-refunded. |

## Security review (Phase 1 sign-off)

The whole codebase was reviewed. Findings and status:

1. **High — MFA bypass for parents who enabled MFA (fixed).** Prefetch requests and server-action POSTs to public paths skipped the proxy, and `requireUser()` only enforced `aal2` for admin roles. `requireUser()` now requires `aal2` for anyone with a verified factor.
2. **Medium — sellers could relist a listing a moderator removed (fixed).** A new `removed_by_admin` flag plus a trigger stop sellers from changing the flag, reactivating moderated listings, or relisting items with a paid order. Covered by tests.
3. **Medium — open redirect via a tab character in `?next=` (fixed).** `safeNext()` now rejects control characters and resolves the URL to confirm it stays same-origin. Covered by tests.

Checked and found sound: RLS policies and grants, SECURITY DEFINER functions (empty `search_path`), storage policies, the webhook/checkout flow, search filters, and XSS (no `dangerouslySetInnerHTML`; stored URLs are https-only).

## Remaining risks (accepted for Phase 1, with recommended action)

1. **Photos of children can still be uploaded.** The attestation, reporting and admin removal are deterrents, not prevention. *Action:* add automated person detection (paid) or manual pre-approval before launch at scale.
2. **Messages aren't scanned.** Grooming or scam content between adults and teens isn't possible by design (no minor accounts), but scams between adults are. Admins cannot read messages (a privacy choice), so reports must quote the content. *Action:* add a "report message" flow that copies the reported message to moderators.
3. **Age and role are self-declared.** "18+" and "school administrator" are attestations. School powers require manual verification of a claim, but anyone can create a school-admin account (it grants nothing until a claim is approved).
4. **The rate limiter trusts `x-real-ip` / `x-forwarded-for`.** This is safe on Vercel/Netlify, which set these headers. On another host behind no proxy, IP-based limits could be spoofed (per-account limits still apply). Also turn on Supabase's own Auth rate limits and CAPTCHA (Turnstile, free) in the dashboard.
5. **Supabase's default email sender** is for testing only. *Action:* configure custom SMTP before launch.
6. **No breached-password check.** Supabase's leaked-password protection requires a paid plan.
7. **Legal pages are drafts.** COPPA, CCPA and GDPR (Ireland/UK users) obligations need a lawyer's review, including data retention for order records and a process for parental data requests.
8. **Stripe disputes and fraud.** Direct charges put chargebacks on the seller, with Stripe covering negative balances under this account configuration. Buyer-protection policy (non-delivery, item not as described) isn't defined yet.
9. **Platform admin is a single SQL flag.** Protect that account with MFA (enforced) and a unique password; consider a second admin for review of claim approvals.
10. **Dependencies.** `npm audit` is clean today and runs in CI; keep Dependabot (free) on.

## Reporting a vulnerability
Email the project owner. Don't open a public issue.
