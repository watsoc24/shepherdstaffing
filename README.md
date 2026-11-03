# Shepherd Staffing

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
| `npm test` | Vitest (needs a Postgres test DB, default `shepherd_app_test`; override with `TEST_DATABASE_URL`) |
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
- [ ] M3 Profiles · M4 Billing · M5 Matching + Chat · M6 Messaging · M7 Interview · M8 Intake + Admin · M9 Compliance + Ops · M10 Launch hardening
