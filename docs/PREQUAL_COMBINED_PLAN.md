# PreQual + Shepherd — combined plan

**Date:** Nov 11, 2026 — approved by the user in the PreQual AI chat ("Yes — build the combined plan and port PreQual into Shepherd").
**Decision:** One product, one database. **Shepherd Staffing is the product. PreQual AI is its screening engine, not a second product.**

## Why this model

- **Generic job search database — rejected.** Online recruitment is $37–43B globally, with Indeed ~20% share and LinkedIn ~15%; Indeed reaches 92.9% of US online job seekers. A $0-budget solo build cannot win network effects there.
- **PreQual AI alone, for all SMBs — rejected as the lead.** Pre-employment testing is $3.1–4.25B, but HireVue, Criteria, Wonderlic, SHL, Checkr and every ATS already screen, and Indeed gives basic screening away. It is a feature, not a company.
- **Shepherd Staffing for non-mega churches — the wedge.** ~356,739 US congregations (2020 Religion Census), ~373,000 by the broader Hartford estimate, median 70 people, only ~1,850 megachurches. 70% have key roles to fill; only ~a third use formal recruiting. Vanderbloemen (250k-candidate DB, 4,100+ clients) and ChurchStaffing.com ($249/mo) serve the top end. The non-mega church that hires once every year or two, cannot pay retained-search fees, and needs doctrine / culture / calling fit is underserved — and it is the founder's background.

PreQual's value in that model is as a **lead magnet and pre-screen**: a free, 5-minute questionnaire that grows the candidate database, then Shepherd's AI matching does what a rubric cannot — theology, culture, and calling fit.

## What was ported (Phase 1, this change)

From `~/workspace/projects/prequal-ai/` (fresh build, Nov 10, 2026 — landing page, 7-step questionnaire, 0–100 scoring, localStorage only, no backend):

| PreQual piece | Shepherd home |
|---|---|
| 0–100 scoring, weights Experience 25 / Availability 20 / Practical 20 / Mission 20 / Communication 15; thresholds Advance 80+, Review 60–79, Not advancing <60; any knockout "no" = Not advancing | `src/lib/scoring/prequal.ts` — pure function, no DB import, unit-tested in `tests/prequal.test.ts` |
| 3 knockout questions + 10 scored questions (0–4 each, 2 per category) | Same file: `PREQUAL_QUESTIONS`, `PREQUAL_KNOCKOUTS`, `scorePreQual()` — verbatim values from PreQual `app.js` |
| localStorage submissions | `PreQualAssessment` in `prisma/schema.prisma` + migration `20261112000000_prequal_assessment` — one Postgres table, linked to `Candidate` and `Church` when known, nullable both so anonymous lead-magnet submissions can be stored before an account exists |
| Hiring-team summary table + CSV export | `src/lib/db/prequal.ts` (`createAssessment`, `listForChurch`, `listForCandidate`) + `POST /api/prequal/submit` (server-side scoring — never trust a client score) |
| Landing page + questionnaire | `src/pages/prequal.tsx` — public page using the existing `Layout` / `Field` components; linked from the home page |
| Standalone PreQual brand | Retired as a separate product. The name survives only as a feature: "PreQual screening, by Shepherd Staffing." See `~/workspace/projects/prequal-ai/README.md` (updated to point here). |

## Data model

```
PreQualAssessment
  id, createdAt, updatedAt
  candidateId String?  -> Candidate?   (set when the applicant has an account)
  churchId    String?  -> Church?      (set when the assessment is for a specific church role)
  applicantName String, applicantEmail String   (plain, like Inquiry.contactName/contactEmail)
  role        String
  answers     Json   // { authorized: 1, exp_years: 4, ... } — question ids from PREQUAL_QUESTIONS
  breakdown   Json   // { experience: 22, availability: 18, ... } — points per category
  score       Int    // 0-100
  recommendation PreQualRecommendation // advance | review | not_advancing
  knockoutFailed Boolean
  flags       Json   // string[]
  modelVersion String // "prequal-v1" — bump when weights/questions change; old scores stay explainable
```

Indexes: `(churchId, score)`, `(candidateId, createdAt)`. No encrypted columns in v1: answers are 0–4 integers and short labels, no free-text calling notes. If free-text answers are ever added, they go through the existing AES-256-GCM path (`src/lib/security/crypto.ts`) like `Candidate.callingNotesEnc`, not plaintext.

## Rules carried over from Shepherd

- All DB access only through `src/lib/db/*` (Decision #1). Routes never import the Prisma client.
- API routes use the `api()` wrapper in `src/lib/api/handler.ts` — method allow-list, same-origin CSRF on state-changing methods, uniform JSON errors.
- Rate limiting: new `prequalSubmit` limit, 10/hour per IP (added to `LIMITS` in `src/lib/security/rateLimit.ts`). Public endpoint, so per-IP is the only key available before signup.
- No client-supplied score is trusted. The API re-scores from the validated answers.
- Screening questions are a demo rubric, not legal advice. Knockout / background-check wording has **not** had legal review and must be reviewed for jurisdiction and role before live use (same caveat as the PreQual README).

## What this is NOT yet

- **Not M3 Profiles done.** This port is the screening half of M3. Full candidate/church profile editing, verification, and profile scores are still M3 work.
- **Not matching.** `Match` scoring (AI / Gabriel rubric: doctrine 40%, relational 35%, character 15%, communication 7%, practical 3%) is unchanged and separate. PreQual is practical screening; Match is compatibility. A future step can feed a PreQual score into a Match breakdown as one input, with its weight recorded — not done here.
- **Not billing-gated.** Any authenticated church can view its own assessments in this phase. Gating assessments behind a tier is M4 Billing work; do not add it ad hoc.
- **Not SMB yet.** Generic `Employer` profiles are Phase 2, only after churches prove the flow. No generic-employer code was added.
- **Not deployed.** No Vercel / Supabase changes in this port. Run `npm install && npx prisma generate && npm run db:migrate:dev` before `npm run dev` — see Verification below.

## Verification (this workspace)

This workspace has **no `node_modules` and no generated Prisma client**, and no `DATABASE_URL`. So the full `npm run ci` (typecheck + tests + build) could not be run here. What was verified instead:

1. `src/lib/scoring/prequal.ts` is a pure module with no DB/Next imports. Its logic was checked against PreQual `app.js` question-for-question, and its tests in `tests/prequal.test.ts` cover: all-top answers = 100 / Advance; knockout fail = Not advancing regardless of score; mid-range = Review; all-zero = 0 / Not advancing; and the three SAMPLE applicants (86 Advance, 68 Review, 42 Not advancing) reproduce exactly.
2. Prisma schema + migration SQL were written to match the existing init migration's style. They need `npx prisma generate` + `prisma migrate dev` on a machine with deps + a database before `src/lib/db/prequal.ts` typechecks (it references the new `preQualAssessment` client).
3. To verify end-to-end, on a machine with dependencies: `npm install && npx prisma generate && npm run db:migrate:dev && npm test && npm run typecheck && npm run build`, then `npm run dev` and open `/prequal`.

## Roadmap after Phase 1

1. **M3 Profiles** — candidate/church profile editing; link a PreQual assessment to the signed-in candidate at submit time (currently `candidateId` is set only when the caller is authenticated — see the API route).
2. **Church dashboard** — list a church's assessments, filter by recommendation, export CSV (the PreQual dashboard behaviour, now server-side).
3. **Match input** — optionally include `preQualScore` in `Match.breakdown` with a recorded weight.
4. **Phase 2 — SMB pilot** — generic employer profile reusing the same questionnaire with a different question set version (`modelVersion: prequal-v2-smb`), only if church usage proves the flow.
