-- Irish Dance Connect — Phase 1 schema
-- Every table in `public` has row-level security (RLS) enabled.
-- Privileges are granted explicitly (least privilege) instead of relying on
-- Supabase's default "grant all to anon/authenticated".

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Private schema: helper functions and internal tables. Not exposed by the API.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('parent', 'school_admin');
create type public.school_status as enum ('unclaimed', 'verified');
create type public.claim_status as enum ('pending', 'approved', 'rejected');
create type public.event_status as enum ('pending', 'published', 'rejected');
create type public.listing_category as enum (
  'solo_dress', 'school_costume', 'hard_shoes', 'soft_shoes', 'wig', 'accessories', 'other'
);
create type public.listing_condition as enum ('new', 'like_new', 'good', 'fair');
create type public.listing_status as enum ('active', 'sold', 'removed');
create type public.order_status as enum ('pending', 'paid', 'cancelled', 'refunded');
create type public.dance_level as enum (
  'beginner', 'advanced_beginner', 'novice', 'prizewinner',
  'preliminary_championship', 'open_championship', 'adult', 'other'
);
create type public.report_target as enum ('listing', 'message', 'school', 'feis_event');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Per-user quota. Args: user column, max rows, window ('24 hours') or 'total'.
create or replace function private.enforce_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_col text := tg_argv[0];
  v_max int := tg_argv[1]::int;
  v_window text := tg_argv[2];
  v_user uuid := (to_jsonb(new) ->> v_col)::uuid;
  v_count int;
begin
  if v_user is null then
    return new;
  end if;
  if v_window = 'total' then
    execute format('select count(*) from %I.%I where %I = $1', tg_table_schema, tg_table_name, v_col)
      into v_count using v_user;
  else
    execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - $2::interval',
                   tg_table_schema, tg_table_name, v_col)
      into v_count using v_user, v_window;
  end if;
  if v_count >= v_max then
    raise exception 'quota_exceeded' using errcode = 'P0001',
      hint = format('Limit of %s reached for %s', v_max, tg_table_name);
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
-- Public-facing name only. Never a child's name (enforced by UI guidance).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Role and admin flag live in a separate, owner-read-only table.
-- Users can never write to it; the platform-admin flag is set by hand in SQL.
create table public.account_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'parent',
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 60);
  v_role public.user_role := case
    when new.raw_user_meta_data ->> 'role' = 'school_admin' then 'school_admin'::public.user_role
    else 'parent'::public.user_role end;
begin
  if v_name = '' then v_name := 'Member'; end if;
  insert into public.profiles (id, display_name) values (new.id, v_name);
  insert into public.account_roles (user_id, role) values (new.id, v_role);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Helper predicates used by policies (security definer so they can read
-- account_roles / school_admins regardless of the caller's RLS).
create or replace function private.has_aal2()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select r.is_platform_admin from public.account_roles r where r.user_id = auth.uid()),
    false) and private.has_aal2()
$$;

create or replace function private.is_school_admin_role()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.account_roles r
    where r.user_id = auth.uid() and r.role = 'school_admin')
$$;

-- ---------------------------------------------------------------------------
-- Schools directory
-- ---------------------------------------------------------------------------
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 140),
  city text check (city is null or char_length(city) <= 80),
  region text check (region is null or char_length(region) <= 80),
  country text check (country is null or char_length(country) <= 56),
  website_url text check (website_url is null or (website_url ~* '^https://[^\s]+$' and char_length(website_url) <= 300)),
  public_email text check (public_email is null or (public_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(public_email) <= 254)),
  description text check (description is null or char_length(description) <= 2000),
  status public.school_status not null default 'unclaimed',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger schools_updated_at before update on public.schools
  for each row execute function private.set_updated_at();

create table public.school_admins (
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (school_id, user_id)
);
create index school_admins_user_idx on public.school_admins (user_id);

create or replace function private.is_school_admin(p_school uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.school_admins a
    where a.school_id = p_school and a.user_id = auth.uid())
$$;

create table public.school_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  school_id uuid references public.schools (id) on delete cascade,
  proposed_name text check (proposed_name is null or char_length(btrim(proposed_name)) between 2 and 120),
  proposed_city text check (proposed_city is null or char_length(proposed_city) <= 80),
  proposed_region text check (proposed_region is null or char_length(proposed_region) <= 80),
  proposed_country text check (proposed_country is null or char_length(proposed_country) <= 56),
  proposed_website text check (proposed_website is null or (proposed_website ~* '^https://[^\s]+$' and char_length(proposed_website) <= 300)),
  claimant_title text not null check (char_length(btrim(claimant_title)) between 2 and 80),
  contact_email text not null check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(contact_email) <= 254),
  evidence text not null check (char_length(btrim(evidence)) between 10 and 1000),
  status public.claim_status not null default 'pending',
  reviewer_note text check (reviewer_note is null or char_length(reviewer_note) <= 500),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (school_id is not null or proposed_name is not null)
);
create unique index school_claims_one_pending
  on public.school_claims (user_id, school_id) where status = 'pending';
create trigger school_claims_quota before insert on public.school_claims
  for each row execute function private.enforce_quota('user_id', '5', '24 hours');

-- Platform admin approves/rejects a claim. Creates the school if it was new.
create or replace function public.review_school_claim(p_claim uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.school_claims%rowtype;
  v_school uuid;
  v_slug text;
begin
  if not private.is_platform_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v_claim from public.school_claims where id = p_claim and status = 'pending' for update;
  if not found then
    raise exception 'claim_not_found';
  end if;

  if p_approve then
    v_school := v_claim.school_id;
    if v_school is null then
      v_slug := trim(both '-' from regexp_replace(lower(v_claim.proposed_name), '[^a-z0-9]+', '-', 'g'));
      v_slug := left(coalesce(nullif(v_slug, ''), 'school'), 120) || '-' || substr(md5(random()::text), 1, 6);
      insert into public.schools (name, slug, city, region, country, website_url)
        values (v_claim.proposed_name, v_slug, v_claim.proposed_city, v_claim.proposed_region,
                v_claim.proposed_country, v_claim.proposed_website)
        returning id into v_school;
    end if;
    insert into public.school_admins (school_id, user_id) values (v_school, v_claim.user_id)
      on conflict do nothing;
    update public.schools set status = 'verified', verified_at = coalesce(verified_at, now())
      where id = v_school;
    update public.school_claims
      set status = 'approved', school_id = v_school, reviewer_note = left(p_note, 500), reviewed_at = now()
      where id = p_claim;
  else
    update public.school_claims
      set status = 'rejected', reviewer_note = left(p_note, 500), reviewed_at = now()
      where id = p_claim;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Feis calendar (links out to existing registration sites only)
-- ---------------------------------------------------------------------------
create table public.feis_events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 150),
  starts_on date not null,
  ends_on date not null,
  venue_name text check (venue_name is null or char_length(venue_name) <= 150),
  city text not null check (char_length(btrim(city)) between 1 and 80),
  region text check (region is null or char_length(region) <= 80),
  country text not null check (char_length(btrim(country)) between 2 and 56),
  registration_url text not null check (registration_url ~* '^https://[^\s]+$' and char_length(registration_url) <= 500),
  host_school_id uuid references public.schools (id) on delete set null,
  status public.event_status not null default 'pending',
  submitted_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 14)
);
create index feis_events_published_idx on public.feis_events (starts_on) where status = 'published';
create trigger feis_events_updated_at before update on public.feis_events
  for each row execute function private.set_updated_at();
create trigger feis_events_quota before insert on public.feis_events
  for each row execute function private.enforce_quota('submitted_by', '30', '24 hours');

-- ---------------------------------------------------------------------------
-- Children (owned by the parent account; never public)
-- ---------------------------------------------------------------------------
create table public.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 40),
  birth_year smallint check (birth_year is null or birth_year between 1990 and 2100),
  dance_level public.dance_level,
  school_id uuid references public.schools (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index children_parent_idx on public.children (parent_id);
create trigger children_updated_at before update on public.children
  for each row execute function private.set_updated_at();
create trigger children_quota before insert on public.children
  for each row execute function private.enforce_quota('parent_id', '12', 'total');

-- ---------------------------------------------------------------------------
-- Marketplace
-- ---------------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  category public.listing_category not null,
  size_label text not null check (char_length(btrim(size_label)) between 1 and 40),
  price_cents integer not null check (price_cents between 1000 and 500000),
  shipping_cents integer not null default 0 check (shipping_cents between 0 and 10000),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  condition public.listing_condition not null,
  city text not null check (char_length(btrim(city)) between 1 and 80),
  region text not null check (char_length(btrim(region)) between 1 and 80),
  country text not null default 'US' check (char_length(btrim(country)) between 2 and 56),
  status public.listing_status not null default 'active',
  -- Set only by a platform admin when removing a listing for a policy breach.
  removed_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index listings_active_idx on public.listings (created_at desc) where status = 'active';
create index listings_seller_idx on public.listings (seller_id);
create trigger listings_updated_at before update on public.listings
  for each row execute function private.set_updated_at();
-- Currency always follows the listing country; users cannot set it.
create or replace function private.listing_currency()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.country not in ('US', 'CA', 'GB', 'IE', 'AU', 'NZ') then
    raise exception 'unsupported_country' using errcode = '23514';
  end if;
  new.currency := case new.country
    when 'CA' then 'cad' when 'GB' then 'gbp' when 'IE' then 'eur'
    when 'AU' then 'aud' when 'NZ' then 'nzd' else 'usd' end;
  return new;
end $$;
create trigger listings_currency before insert or update of country on public.listings
  for each row execute function private.listing_currency();
-- Sellers cannot undo a moderator's removal, and cannot relist an item that
-- has a paid order. Only platform admins (or the service role) can.
create or replace function private.guard_listing_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.is_platform_admin() then
    return new;
  end if;
  if new.removed_by_admin is distinct from old.removed_by_admin then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if old.removed_by_admin and new.status <> 'removed' then
    raise exception 'not_authorized' using errcode = '42501', hint = 'Removed by moderator';
  end if;
  if old.status = 'sold' and new.status <> 'sold'
     and exists (select 1 from public.orders o where o.listing_id = old.id and o.status = 'paid') then
    raise exception 'not_authorized' using errcode = '42501', hint = 'Listing has a paid order';
  end if;
  return new;
end $$;
create trigger listings_guard_status before update on public.listings
  for each row execute function private.guard_listing_status();
create trigger listings_quota before insert on public.listings
  for each row execute function private.enforce_quota('seller_id', '20', '24 hours');

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path text not null unique,
  position smallint not null default 0 check (position between 0 and 7),
  created_at timestamptz not null default now(),
  -- path must be "<owner_id>/<listing_id>/<uuid>.jpg"
  check (storage_path = owner_id::text || '/' || listing_id::text || '/' || split_part(storage_path, '/', 3)
         and split_part(storage_path, '/', 3) ~ '^[0-9a-f-]{36}\.jpg$')
);
create index listing_photos_listing_idx on public.listing_photos (listing_id);

create or replace function private.limit_listing_photos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.listing_photos where listing_id = new.listing_id) >= 8 then
    raise exception 'quota_exceeded' using hint = 'Maximum 8 photos per listing';
  end if;
  return new;
end $$;
create trigger listing_photos_limit before insert on public.listing_photos
  for each row execute function private.limit_listing_photos();

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  seller_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);
create index conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);
create trigger conversations_quota before insert on public.conversations
  for each row execute function private.enforce_quota('buyer_id', '30', '24 hours');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_sender_idx on public.messages (sender_id, created_at desc);

-- Messaging rate limit, enforced in the database so it cannot be bypassed
-- by calling the API directly: 10 per minute and 200 per day per sender.
create or replace function private.message_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 10
  or (select count(*) from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '24 hours') >= 200 then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'Too many messages. Please wait a moment.';
  end if;
  return new;
end $$;
create trigger messages_rate_limit before insert on public.messages
  for each row execute function private.message_rate_limit();

create or replace function private.touch_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end $$;
create trigger messages_touch_conversation after insert on public.messages
  for each row execute function private.touch_conversation();

-- Used by the conversations insert policy (security definer avoids a
-- listings <-> conversations policy loop).
create or replace function private.listing_is_active_for_seller(p_listing uuid, p_seller uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.listings l
                 where l.id = p_listing and l.seller_id = p_seller and l.status = 'active')
$$;

-- Stripe Connect seller accounts. Written only by the server (service role).
create table public.seller_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Lets a buyer know whether "Buy" is available without exposing the account id.
create or replace function public.seller_can_accept_payments(p_seller uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select charges_enabled from public.seller_accounts where user_id = p_seller), false)
$$;

-- Orders. Written only by the server (service role) via checkout + webhook.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  listing_title text not null,
  buyer_id uuid references auth.users (id) on delete set null,
  seller_id uuid references auth.users (id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  currency text not null,
  stripe_account_id text not null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  status public.order_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_seller_idx on public.orders (seller_id, created_at desc);
create trigger orders_updated_at before update on public.orders
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reports (moderation)
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null check (char_length(btrim(reason)) between 5 and 1000),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create trigger reports_quota before insert on public.reports
  for each row execute function private.enforce_quota('reporter_id', '20', '24 hours');

-- ---------------------------------------------------------------------------
-- Server-side rate limiter for auth endpoints (called with the service role).
-- ---------------------------------------------------------------------------
create table private.rate_limit_hits (
  key text not null,
  hit_at timestamptz not null default now()
);
create index rate_limit_hits_key_idx on private.rate_limit_hits (key, hit_at);

create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));
  delete from private.rate_limit_hits
    where key = p_key and hit_at < now() - make_interval(secs => p_window_seconds);
  select count(*) into v_count from private.rate_limit_hits where key = p_key;
  if v_count >= p_max then
    return false;
  end if;
  insert into private.rate_limit_hits (key) values (p_key);
  return true;
end $$;

-- ===========================================================================
-- Row-level security
-- ===========================================================================
alter table public.profiles enable row level security;
alter table public.account_roles enable row level security;
alter table public.schools enable row level security;
alter table public.school_admins enable row level security;
alter table public.school_claims enable row level security;
alter table public.feis_events enable row level security;
alter table public.children enable row level security;
alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.seller_accounts enable row level security;
alter table public.orders enable row level security;
alter table public.reports enable row level security;

-- profiles: any signed-in member can see display names (needed for messaging);
-- only the owner can change theirs.
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- account_roles: owner can read; nobody can write through the API.
create policy account_roles_select_own on public.account_roles for select to authenticated
  using (user_id = (select auth.uid()));

-- schools: public directory.
create policy schools_select on public.schools for select to anon, authenticated using (true);
create policy schools_update_admin on public.schools for update to authenticated
  using ((private.is_school_admin(id) and private.has_aal2()) or private.is_platform_admin())
  with check ((private.is_school_admin(id) and private.has_aal2()) or private.is_platform_admin());
create policy schools_insert_platform on public.schools for insert to authenticated
  with check (private.is_platform_admin());
create policy schools_delete_platform on public.schools for delete to authenticated
  using (private.is_platform_admin());

-- school_admins: a user sees their own memberships; platform admin sees all.
create policy school_admins_select on public.school_admins for select to authenticated
  using (user_id = (select auth.uid()) or private.is_platform_admin());

-- school_claims: school-admin accounts with MFA can file claims; claimant and
-- platform admin can read them. Review happens only via review_school_claim().
create policy school_claims_select on public.school_claims for select to authenticated
  using (user_id = (select auth.uid()) or private.is_platform_admin());
create policy school_claims_insert on public.school_claims for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and private.has_aal2()
    and private.is_school_admin_role()
  );

-- feis_events: published events are public. Verified school admins (MFA)
-- may submit events for their school; they stay pending until approved.
create policy feis_select on public.feis_events for select to anon, authenticated
  using (
    status = 'published'
    or submitted_by = (select auth.uid())
    or private.is_platform_admin()
  );
create policy feis_insert on public.feis_events for insert to authenticated
  with check (
    private.is_platform_admin()
    or (
      submitted_by = (select auth.uid())
      and status = 'pending'
      and host_school_id is not null
      and private.is_school_admin(host_school_id)
      and private.has_aal2()
    )
  );
create policy feis_update_platform on public.feis_events for update to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy feis_delete on public.feis_events for delete to authenticated
  using (private.is_platform_admin() or (submitted_by = (select auth.uid()) and status = 'pending'));

-- children: strictly owner-only, every operation.
create policy children_select_own on public.children for select to authenticated
  using (parent_id = (select auth.uid()));
create policy children_insert_own on public.children for insert to authenticated
  with check (parent_id = (select auth.uid()));
create policy children_update_own on public.children for update to authenticated
  using (parent_id = (select auth.uid())) with check (parent_id = (select auth.uid()));
create policy children_delete_own on public.children for delete to authenticated
  using (parent_id = (select auth.uid()));

-- listings: signed-in members see active listings; sellers see their own;
-- buyers keep access to listings they messaged about or bought.
create policy listings_select on public.listings for select to authenticated
  using (
    status = 'active'
    or seller_id = (select auth.uid())
    or exists (select 1 from public.conversations c
               where c.listing_id = listings.id and c.buyer_id = (select auth.uid()))
    or exists (select 1 from public.orders o
               where o.listing_id = listings.id and o.buyer_id = (select auth.uid()))
    or private.is_platform_admin()
  );
create policy listings_insert_own on public.listings for insert to authenticated
  with check (seller_id = (select auth.uid()) and status = 'active');
create policy listings_update_own on public.listings for update to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));
create policy listings_update_platform on public.listings for update to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy listings_delete_own on public.listings for delete to authenticated
  using (seller_id = (select auth.uid()));

-- listing_photos: visible whenever the parent listing is visible.
create policy listing_photos_select on public.listing_photos for select to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_photos.listing_id));
create policy listing_photos_insert_own on public.listing_photos for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.listings l
                where l.id = listing_photos.listing_id and l.seller_id = (select auth.uid()))
  );
create policy listing_photos_delete_own on public.listing_photos for delete to authenticated
  using (owner_id = (select auth.uid()));

-- conversations: only the two participants.
create policy conversations_select on public.conversations for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));
create policy conversations_insert_buyer on public.conversations for insert to authenticated
  with check (
    buyer_id = (select auth.uid())
    and private.listing_is_active_for_seller(listing_id, seller_id)
  );

-- messages: only participants can read; sender must be a participant.
create policy messages_select on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c
                 where c.id = messages.conversation_id
                   and (select auth.uid()) in (c.buyer_id, c.seller_id)));
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (select 1 from public.conversations c
                where c.id = messages.conversation_id
                  and (select auth.uid()) in (c.buyer_id, c.seller_id))
  );

-- seller_accounts: owner can read their own status.
create policy seller_accounts_select_own on public.seller_accounts for select to authenticated
  using (user_id = (select auth.uid()));

-- orders: buyer and seller can read.
create policy orders_select on public.orders for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));

-- reports: reporter can file and read their own; platform admin reads/resolves.
create policy reports_insert_own on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and resolved = false);
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or private.is_platform_admin());
create policy reports_update_platform on public.reports for update to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- ===========================================================================
-- Privileges (least privilege; column-level where users may only edit some fields)
-- ===========================================================================
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant select on public.schools, public.feis_events to anon;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select on public.account_roles to authenticated;

grant select, delete on public.schools to authenticated;
grant insert (name, slug, city, region, country, website_url, public_email, description, status, verified_at)
  on public.schools to authenticated;
-- School admins may edit only these fields; renaming requires the platform admin.
grant update (city, region, country, website_url, public_email, description) on public.schools to authenticated;

grant select on public.school_admins to authenticated;

grant select on public.school_claims to authenticated;
grant insert (school_id, proposed_name, proposed_city, proposed_region, proposed_country,
              proposed_website, claimant_title, contact_email, evidence)
  on public.school_claims to authenticated;

grant select, delete on public.feis_events to authenticated;
grant insert (name, starts_on, ends_on, venue_name, city, region, country, registration_url, host_school_id)
  on public.feis_events to authenticated;
grant update (name, starts_on, ends_on, venue_name, city, region, country, registration_url,
              host_school_id, status)
  on public.feis_events to authenticated;

grant select, delete on public.children to authenticated;
grant insert (nickname, birth_year, dance_level, school_id) on public.children to authenticated;
grant update (nickname, birth_year, dance_level, school_id) on public.children to authenticated;

grant select, delete on public.listings to authenticated;
grant insert (title, description, category, size_label, price_cents, shipping_cents, condition, city, region, country)
  on public.listings to authenticated;
grant update (title, description, category, size_label, price_cents, shipping_cents, condition, city, region, country, status, removed_by_admin)
  on public.listings to authenticated;

grant select, delete on public.listing_photos to authenticated;
grant insert (listing_id, storage_path, position) on public.listing_photos to authenticated;

grant select on public.conversations to authenticated;
grant insert (listing_id, seller_id) on public.conversations to authenticated;

grant select on public.messages to authenticated;
grant insert (conversation_id, body) on public.messages to authenticated;

grant select on public.seller_accounts to authenticated;
grant select on public.orders to authenticated;

grant select on public.reports to authenticated;
grant insert (target_type, target_id, reason) on public.reports to authenticated;
grant update (resolved) on public.reports to authenticated;

-- Functions callable through the API
grant execute on function public.review_school_claim(uuid, boolean, text) to authenticated;
grant execute on function public.seller_can_accept_payments(uuid) to authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

-- Helpers used inside policies must be executable by API roles.
grant execute on function private.has_aal2() to anon, authenticated;
grant execute on function private.is_platform_admin() to anon, authenticated;
grant execute on function private.is_school_admin_role() to authenticated;
grant execute on function private.is_school_admin(uuid) to anon, authenticated;
grant execute on function private.listing_is_active_for_seller(uuid, uuid) to authenticated;

-- ===========================================================================
-- Storage: private bucket for listing photos (JPEG only, max 2 MB).
-- Files live at "<user_id>/<listing_id>/<uuid>.jpg".
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy listing_photos_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy listing_photos_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'listing-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.listing_photos p where p.storage_path = objects.name)
    )
  );
create policy listing_photos_storage_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
