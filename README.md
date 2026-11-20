# Fit For Ministry

AI-assisted church recruiting platform. Candidates (pastors and ministry professionals) and
churches build detailed profiles; AI scores compatibility; paid members can contact matches;
recruiters run Assisted and Full searches from the admin area.

**Stack:** Next.js (Pages Router, `src/`) · TypeScript · Postgres via Prisma (Supabase in production) ·
Upstash Redis · Stripe · Brevo · Anthropic API · Zod · Vitest. Deployed on Vercel behind Cloudflare.

The build spec lives outside the repo; decisions taken against it are recorded in `docs/DECISIONS.md`.

## Local setup

```bash
npm install
cp .env.example .env
npm run gen:secrets        # paste the three lines into .env
# Postgres: local install, Docker, or a free Supabase project — put its URL in DATABASE_URL
npm run db:migrate:dev
npm run dev                # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Vitest (needs a Postgres test DB, default `fit_for_ministry_test`; override with `TEST_DATABASE_URL`) |
| `npm run typecheck` | TypeScript |
| `npm run build` | Production build |
| `npm run ci` | All of the above |
| `npm run db:migrate` | Apply migrations (production) |
| `npm run gen:secrets` | Generate `JWT_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET` |

## Layout

```
src/pages            routes (thin)        src/lib/db        data access — the only DB entry point
src/components       shared UI            src/lib/auth      sessions, guards, CSRF
src/context          AuthContext          src/lib/security  crypto, rate limits, sanitize, audit
src/content          legal markdown       src/lib/ai, billing, email, scoring, vendors
```

## Milestone status

- [x] **M1 Foundation** — scaffold, env validation, data layer, Redis rate limiter, AES-256-GCM crypto, audit log, strict CSP, CI
- [x] **M2 Auth** — signup, hashed single-use verify tokens, trial-at-verify, login with lockout, reset, session versioning, CSRF, entitlements, guards
- [x] **PreQual port (Nov 11, 2026)** — PreQual AI's 0–100 screening (weights, knockouts, thresholds) ported as `src/lib/scoring/prequal.ts`, `PreQualAssessment` in Prisma, `POST /api/prequal/submit`, and the public `/prequal` page. See `docs/PREQUAL_COMBINED_PLAN.md`. One product, one database: Fit For Ministry is the product, PreQual is its screening engine.
- [x] **PreQual dashboard (Nov 12, 2026)** — `GET /api/prequal/assessments` + `/dashboard/prequal` (church sees only its own church's assessments, candidate only their own; filter by recommendation, CSV export).
- [x] **M3 Profiles (Nov 12, 2026)** — `src/lib/profiles.ts` (only sanctioned path to encrypted columns; completeness scores 0–100; public views that strip private fields), `GET/PUT /api/profiles/candidate` and `/api/profiles/church`, `/dashboard/candidate` and `/dashboard/church` pages with public + encrypted private sections, visibility toggle, and PreQual linkage.
- [x] **M4 Billing (Nov 12, 2026)** — Stripe memberships: `stripe` SDK added, `src/lib/billing/stripe.ts` (client + $49/mo / $299/yr prices from env), `src/lib/billing/subscriptions.ts` (status mapping + sync), `POST /api/billing/checkout`, `/api/billing/portal`, `GET /api/billing/status`, and the signature-verified, idempotent `POST /api/billing/webhook`. Pages: `/pricing`, `/dashboard/billing`, `/billing/success`. Test-mode keys until launch; no live charge has been run.
- [x] **M5 Matching + Chat (Nov 12, 2026)** — `@anthropic-ai/sdk` added; deterministic match scorer (`src/lib/matching/score.ts`, theology 30 / position 20 / experience 15 / geography 15 / PreQual 20, hash-cached, PreQual optional-neutral) with LLM narrative for the top 5 pairs and a rule-based fallback; `GET /api/matches`, `POST /api/matches/refresh`, `POST /api/matches/dismiss`; FitCoach chat (`GET/POST /api/chat`, trial cap 10 lifetime, paid unlimited within fair use). Pages: `/dashboard/matches`, `/dashboard/chat`. No live LLM call has been run from this code.
- [x] **M6 Messaging (Nov 12, 2026)** — Contact starts as a request from a live, non-dismissed match (membership required — `canContact`); the recipient accepts or declines, and only after acceptance are contact details shared (`contactSharedAt`) and both sides free to write. While a request is pending nobody writes more. Declined threads can be re-requested; a block closes the thread; reports are held for admin review (M8). Email notifications via Brevo `sendEmailSafe` (non-critical — a failed email never blocks a message). `GET /api/threads`, `POST /api/threads/start`, `GET /api/threads/detail`, `POST /api/threads/messages`, `POST /api/threads/accept|decline|block|report`. Page: `/dashboard/messages`; Contact button added to `/dashboard/matches`.
- [x] **M7 Interview (Nov 12, 2026)** — Async structured interview: six written questions (calling, doctrine, conflict, team, failure, family), candidate answers in their own time, answers encrypted at rest (`interview.answers` AES-256-GCM), consent version recorded, submit locks the draft. A recruiter (admin) evaluates 0–4 per question and the rubric scores it 0–100; a retake needs an admin and is audited. The candidate chooses which matched churches may see the evaluation; churches see the score and evaluation only, never the raw answers, and viewing results requires a membership. Trial members may take the interview. `GET /api/interviews`, `POST /api/interviews/start|answers|submit|share`, `POST /api/interviews/evaluate|retake` (admin), `GET /api/interviews/shared|results`. Pages: `/dashboard/interview`, `/dashboard/interview-results`.
- [x] **M8 Intake + Admin (Nov 12, 2026)** — Public intake for the assisted/full recruiting service (`POST /api/inquiries`, linked on the homepage) with the assisted/full tiers, stored in full. Admin dashboard at `/admin`: inquiry pipeline (new → contacted → scoped → won → lost, convert a won inquiry into an engagement), engagement list, moderation queue for reports, candidate verification (admin-only, the gap M3 left open), account tools (extend trial 1–90 days, deactivate with session revocation, role changes — never your own), and the audit trail. Every admin action is audited; reading a candidate's decrypted private fields goes through one audited endpoint (`admin.decrypt_read`) and nowhere else. Admin list endpoints never return password hashes or tokens. Pushed Nov 12, 2026 (commit `a7380d41`).
- [x] **M9 Compliance + Ops (Nov 12, 2026)** — The user's own data, on their terms. `/dashboard/account`: password change, consent versions, one-click JSON export of everything held about them, and account closure (type DELETE; soft delete + session revocation, personal data purged within 30 days per `docs/RETENTION.md`). An active paid subscription must be cancelled first, so we never take money from an account that no longer exists. Draft `/terms` and `/privacy` pages (footer links no longer 404; attorney review still needed). Interview consent is now recorded as a Consent row (new `interview` enum value, migration `20261113000000_interview_consent`). Ops cron `POST /api/cron/trial-reminders` (CRON_SECRET-guarded, CSRF off): trial reminders 3 days out and trial expiry, each user touched once. Security headers + CSP already live in `next.config.ts` (M2). Pushed Nov 17, 2026 (commit `aa790a1d`) with the Fit For Ministry rebrand.
- [ ] M10 Launch hardening
