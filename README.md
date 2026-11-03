# Irish Dance Connect — Phase 1

A mobile-first web app (installable on iPhone from Safari via "Add to Home Screen") for Irish dance families and schools:

- **Feis calendar:** upcoming feiseanna, each linking to its official registration site.
- **School directory:** schools claim their listing; the platform admin verifies them by hand.
- **Dress & gear marketplace:** listings with photos, buyer–seller messaging, and Stripe checkout with a 7% platform fee.
- **Accounts:** parents and school admins (admins must use an authenticator app), plus private dancer profiles owned by parents.

Stack: Next.js 16, Supabase (Postgres, Auth, Storage), Stripe Connect, Tailwind. See [SECURITY.md](SECURITY.md) for the security model, review and remaining risks.

---

## Setup guide (iPhone, no coding needed)

> **Nothing here costs money unless noted.** Before each account you create, check the plan you pick says **Free**.

### Step 1 — Supabase (database + logins) — free plan
1. In Safari go to **supabase.com** → **Start your project** → sign up (GitHub sign-in is easiest).
2. **New project** → name `irish-dance-connect` → make up a strong database password (save it in Passwords) → pick the region closest to most users → **Free** plan → **Create**.
3. Create the tables: open this repo on github.com in Safari → `supabase/migrations/20261103000000_init.sql` → tap **Raw** → tap and hold → **Select All** → **Copy**. Then in Supabase tap **SQL Editor** → **New query** → paste → **Run**. You should see "Success".
4. **Authentication → Sign In / Providers → Email:** make sure **Confirm email** is ON. Set the minimum password length to **10**.
5. **Authentication → URL Configuration:** set **Site URL** to your site address (from Step 2; you can come back to this). Add `https://YOUR-SITE/auth/confirm` under **Redirect URLs**.
6. **Authentication → Emails → Templates:**
   - **Confirm signup:** replace the link with `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/account`
   - **Reset password:** replace the link with `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/account/password`
   - *Why:* this makes email links work even if you open them in a different app than the one you signed up in.
7. **Project Settings → API Keys:** you'll copy the **Project URL**, the **Publishable key** and the **Secret key** into Step 2. Never paste the secret key anywhere else.

### Step 2 — Hosting
- **Vercel (Hobby, free)** is fine for private testing. Its free plan is for **non-commercial use only**, though, so before you charge the 7% fee you need **Vercel Pro (paid)** or a host whose free plan allows commercial use, such as Netlify. Check their current terms.
- On Vercel: **Add New → Project → Import** this GitHub repo → under **Environment Variables**, add each line from `.env.example` with your real values → **Deploy**.
- Put the address Vercel gives you into `SITE_URL`, and into Supabase Step 5.

### Step 3 — Make yourself the platform admin
1. Sign up on your site, confirm your email, and sign in.
2. In Supabase **SQL Editor** run (with your email):
   ```sql
   update public.account_roles set is_platform_admin = true
   where user_id = (select id from auth.users where email = 'you@example.com');
   ```
3. Sign in again. You'll be asked to set up an authenticator app, and then **Admin** appears in the menu.

### Step 4 — Stripe (payments) — no monthly fee; Stripe takes a cut of each payment
1. **stripe.com** → sign up → stay in **Test mode** for now.
2. **Connect → Get started** → choose a platform/marketplace setup where sellers have their own Stripe accounts. Complete the platform profile.
3. **Developers → API keys** → copy the **Secret key** → Vercel env var `STRIPE_SECRET_KEY`.
4. **Developers → Webhooks → Add endpoint** → URL `https://YOUR-SITE/api/stripe/webhook` → choose **Events on Connected accounts** → select `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`, `account.updated` → copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`.
5. Redeploy on Vercel. Test with card `4242 4242 4242 4242`.

### Step 5 — Before real users
- Set up custom SMTP in Supabase. The built-in sender is for testing only and sends only a few emails per hour.
- Turn on CAPTCHA in Supabase Auth (Cloudflare Turnstile is free).
- Have a lawyer review `/privacy` and `/terms`. Work through the remaining risks in SECURITY.md.

---

## For developers
```bash
npm ci
cp .env.example .env.local   # fill in values; never commit
npm run dev
npm run lint && npm run typecheck && npm test
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:rls
```
RLS tests run against plain Postgres using `tests/rls/supabase-shim.sql`. Never run the shim against a real Supabase project.

**Pricing decisions.**
- The fee is 7% of item plus shipping, with a minimum price of 10.00. Below roughly $10, Stripe's fixed per-payment fee makes small sales poor value.
- Checkout uses **direct charges**, so the seller pays Stripe's processing fee, the platform keeps the full 7%, and Stripe handles negative balances. There are no per-account Connect fees with this setup; check Stripe's current Connect pricing.
