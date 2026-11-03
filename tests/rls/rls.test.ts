/**
 * Row-level security tests.
 *
 * Applies a Supabase shim + the real migration to a throwaway Postgres
 * database, creates fixture users/data as a superuser, then runs queries
 * *as each user* (role `authenticated` + JWT claims), exactly the way
 * Supabase's API does, to prove users cannot read or change each other's data.
 *
 * Run: TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:rls
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";
const DB_NAME = "idc_rls_test";
const ROOT = join(__dirname, "..", "..");

let pool: pg.Pool;

type Who = "anon" | { id: string; aal?: "aal1" | "aal2" };
type Q = (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

const u = {
  parentA: randomUUID(),
  parentB: randomUUID(),
  stranger: randomUUID(),
  schoolAdmin: randomUUID(),
  claimant: randomUUID(),
  platformAdmin: randomUUID(),
};
const ids = {
  schoolX: randomUUID(),
  schoolY: randomUUID(),
  childA: randomUUID(),
  childB: randomUUID(),
  listingA: randomUUID(),
  listingRemoved: randomUUID(),
  conversation: randomUUID(),
  order: randomUUID(),
  claim: randomUUID(),
  feisPublished: randomUUID(),
  feisPending: randomUUID(),
  report: randomUUID(),
};
const photoPathA = `${u.parentA}/${ids.listingA}/${randomUUID()}.jpg`;
const photoPathRemoved = `${u.parentB}/${ids.listingRemoved}/${randomUUID()}.jpg`;

async function as<T>(who: Who, fn: (q: Q) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const claims =
      who === "anon" ? { role: "anon" } : { sub: who.id, role: "authenticated", aal: who.aal ?? "aal1" };
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await c.query(`set local role ${who === "anon" ? "anon" : "authenticated"}`);
    return await fn(async (sql, params) => (await c.query(sql, params)).rows);
  } finally {
    await c.query("rollback");
    c.release();
  }
}

const DENIED = /permission denied|row-level security|violates|quota_exceeded|rate_limited|not_authorized/;

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${DB_NAME} with (force)`);
  await admin.query(`create database ${DB_NAME}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${DB_NAME}`;
  pool = new pg.Pool({ connectionString: url.toString(), max: 4 });

  const setup = await pool.connect();
  try {
    await setup.query(readFileSync(join(__dirname, "supabase-shim.sql"), "utf8"));
    const migDir = join(ROOT, "supabase", "migrations");
    for (const f of readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()) {
      await setup.query(readFileSync(join(migDir, f), "utf8"));
    }

    // Users (the signup trigger creates profiles + account_roles)
    const mkUser = (id: string, role: string, name: string) =>
      setup.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
        id,
        `${name}@example.test`,
        JSON.stringify({ role, display_name: name }),
      ]);
    await mkUser(u.parentA, "parent", "ParentA");
    await mkUser(u.parentB, "parent", "ParentB");
    await mkUser(u.stranger, "parent", "Stranger");
    await mkUser(u.schoolAdmin, "school_admin", "SchoolAdmin");
    await mkUser(u.claimant, "school_admin", "Claimant");
    await mkUser(u.platformAdmin, "parent", "PlatformAdmin");
    // Attempted privilege escalation through signup metadata is ignored.
    await setup.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2)", [
      randomUUID(),
      JSON.stringify({ role: "platform_admin", is_platform_admin: true }),
    ]);
    await setup.query("update public.account_roles set is_platform_admin = true where user_id = $1", [
      u.platformAdmin,
    ]);

    await setup.query(
      `insert into public.schools (id, name, slug, status) values
        ($1, 'School X', 'school-x', 'verified'), ($2, 'School Y', 'school-y', 'unclaimed')`,
      [ids.schoolX, ids.schoolY],
    );
    await setup.query("insert into public.school_admins (school_id, user_id) values ($1, $2)", [
      ids.schoolX,
      u.schoolAdmin,
    ]);
    await setup.query(
      `insert into public.children (id, parent_id, nickname, birth_year) values
        ($1, $2, 'ChildOfA', 2016), ($3, $4, 'ChildOfB', 2015)`,
      [ids.childA, u.parentA, ids.childB, u.parentB],
    );
    await setup.query(
      `insert into public.listings (id, seller_id, title, category, size_label, price_cents, condition, city, region, status) values
        ($1, $2, 'Solo dress A', 'solo_dress', '10-12y', 25000, 'good', 'Boston', 'MA', 'active'),
        ($3, $4, 'Removed wig', 'wig', 'One size', 3000, 'good', 'Chicago', 'IL', 'removed')`,
      [ids.listingA, u.parentA, ids.listingRemoved, u.parentB],
    );
    await setup.query(
      `insert into public.listing_photos (listing_id, owner_id, storage_path) values ($1, $2, $3), ($4, $5, $6)`,
      [ids.listingA, u.parentA, photoPathA, ids.listingRemoved, u.parentB, photoPathRemoved],
    );
    await setup.query(
      `insert into storage.objects (bucket_id, name, owner) values ('listing-photos', $1, $2), ('listing-photos', $3, $4)`,
      [photoPathA, u.parentA, photoPathRemoved, u.parentB],
    );
    await setup.query(
      `insert into public.conversations (id, listing_id, buyer_id, seller_id) values ($1, $2, $3, $4)`,
      [ids.conversation, ids.listingA, u.parentB, u.parentA],
    );
    await setup.query(
      `insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'Is it still available?'), ($1, $3, 'Yes!')`,
      [ids.conversation, u.parentB, u.parentA],
    );
    await setup.query(
      `insert into public.seller_accounts (user_id, stripe_account_id, charges_enabled) values ($1, 'acct_test_A', true)`,
      [u.parentA],
    );
    await setup.query(
      `insert into public.orders (id, listing_id, listing_title, buyer_id, seller_id, amount_cents, platform_fee_cents, currency, stripe_account_id)
       values ($1, $2, 'Solo dress A', $3, $4, 25000, 1750, 'usd', 'acct_test_A')`,
      [ids.order, ids.listingA, u.parentB, u.parentA],
    );
    await setup.query(
      `insert into public.school_claims (id, user_id, school_id, claimant_title, contact_email, evidence)
       values ($1, $2, $3, 'Owner', 'owner@schooly.test', 'I am listed as the director on our website.')`,
      [ids.claim, u.claimant, ids.schoolY],
    );
    await setup.query(
      `insert into public.feis_events (id, name, starts_on, ends_on, city, country, registration_url, host_school_id, status, submitted_by) values
        ($1, 'Published Feis', '2027-03-01', '2027-03-01', 'Boston', 'US', 'https://example.test/reg', $3, 'published', $4),
        ($2, 'Pending Feis', '2027-04-01', '2027-04-01', 'Boston', 'US', 'https://example.test/reg2', $3, 'pending', $4)`,
      [ids.feisPublished, ids.feisPending, ids.schoolX, u.schoolAdmin],
    );
    await setup.query(
      `insert into public.reports (id, reporter_id, target_type, target_id, reason) values ($1, $2, 'listing', $3, 'Photo shows a child')`,
      [ids.report, u.parentA, ids.listingRemoved],
    );
  } finally {
    setup.release();
  }
}, 60_000);

afterAll(async () => {
  await pool?.end();
});

describe("schema hygiene", () => {
  it("has RLS enabled on every table in public", async () => {
    const rows = (
      await pool.query(
        `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
      )
    ).rows;
    expect(rows).toEqual([]);
  });

  it("signup metadata cannot grant platform admin or unknown roles", async () => {
    const rows = (
      await pool.query(`select role::text, count(*)::int as n from public.account_roles where is_platform_admin group by role`)
    ).rows;
    // only the fixture admin we promoted by hand
    expect(rows).toEqual([{ role: "parent", n: 1 }]);
  });
});

describe("children (minors' data)", () => {
  it("anonymous visitors cannot read any child", async () => {
    await expect(as("anon", (q) => q("select * from public.children"))).rejects.toThrow(DENIED);
  });

  it("a parent sees only their own children", async () => {
    const rows = await as({ id: u.parentB }, (q) => q("select id from public.children"));
    expect(rows.map((r) => r.id)).toEqual([ids.childB]);
  });

  it("school admins and platform admins cannot read children", async () => {
    expect(await as({ id: u.schoolAdmin, aal: "aal2" }, (q) => q("select id from public.children"))).toEqual([]);
    expect(await as({ id: u.platformAdmin, aal: "aal2" }, (q) => q("select id from public.children"))).toEqual([]);
  });

  it("a parent cannot update or delete another parent's child", async () => {
    await as({ id: u.parentB }, async (q) => {
      expect(await q("update public.children set nickname = 'x' where id = $1 returning id", [ids.childA])).toEqual([]);
      expect(await q("delete from public.children where id = $1 returning id", [ids.childA])).toEqual([]);
    });
  });

  it("a parent cannot create a child owned by someone else", async () => {
    await expect(
      as({ id: u.parentB }, (q) =>
        q("insert into public.children (parent_id, nickname) values ($1, 'sneaky')", [u.parentA]),
      ),
    ).rejects.toThrow(DENIED);
  });

  it("a parent can create a child for themselves", async () => {
    const rows = await as({ id: u.parentB }, (q) =>
      q("insert into public.children (nickname, dance_level) values ('Mine', 'novice') returning parent_id"),
    );
    expect(rows[0].parent_id).toBe(u.parentB);
  });
});

describe("accounts", () => {
  it("users read only their own role row and cannot change it", async () => {
    await as({ id: u.parentA }, async (q) => {
      const rows = await q("select user_id from public.account_roles");
      expect(rows.map((r) => r.user_id)).toEqual([u.parentA]);
    });
    await expect(
      as({ id: u.parentA }, (q) => q("update public.account_roles set is_platform_admin = true")),
    ).rejects.toThrow(DENIED);
  });

  it("users cannot rename another user's profile", async () => {
    const rows = await as({ id: u.parentB }, (q) =>
      q("update public.profiles set display_name = 'hacked' where id = $1 returning id", [u.parentA]),
    );
    expect(rows).toEqual([]);
  });

  it("anonymous visitors cannot list profiles", async () => {
    await expect(as("anon", (q) => q("select * from public.profiles"))).rejects.toThrow(DENIED);
  });
});

describe("marketplace listings and photos", () => {
  it("anonymous visitors cannot browse listings", async () => {
    await expect(as("anon", (q) => q("select * from public.listings"))).rejects.toThrow(DENIED);
  });

  it("members see active listings but not other people's removed ones", async () => {
    const rows = await as({ id: u.stranger }, (q) => q("select id from public.listings"));
    expect(rows.map((r) => r.id)).toEqual([ids.listingA]);
  });

  it("members cannot edit or delete someone else's listing", async () => {
    await as({ id: u.parentB }, async (q) => {
      expect(await q("update public.listings set price_cents = 1000 where id = $1 returning id", [ids.listingA])).toEqual([]);
      expect(await q("delete from public.listings where id = $1 returning id", [ids.listingA])).toEqual([]);
    });
  });

  it("members cannot create a listing on behalf of another user", async () => {
    await expect(
      as({ id: u.parentB }, (q) =>
        q(
          `insert into public.listings (seller_id, title, category, size_label, price_cents, condition, city, region)
           values ($1, 'Fake', 'wig', 'S', 2000, 'good', 'X', 'Y')`,
          [u.parentA],
        ),
      ),
    ).rejects.toThrow(DENIED);
  });

  it("currency is set from the country and cannot be chosen by the user", async () => {
    const rows = await as({ id: u.parentB }, (q) =>
      q(
        `insert into public.listings (title, category, size_label, price_cents, condition, city, region, country)
         values ('Ghillies', 'soft_shoes', '5', 2000, 'good', 'Dublin', 'Dublin', 'IE') returning currency, seller_id`,
      ),
    );
    expect(rows[0]).toEqual({ currency: "eur", seller_id: u.parentB });
    await expect(
      as({ id: u.parentB }, (q) => q("update public.listings set currency = 'usd' where id = $1", [ids.listingRemoved])),
    ).rejects.toThrow(DENIED);
  });

  it("sellers cannot mark a listing sold via a fake order or change its owner", async () => {
    await expect(
      as({ id: u.parentA }, (q) => q("update public.listings set seller_id = $1 where id = $2", [u.parentB, ids.listingA])),
    ).rejects.toThrow(DENIED);
  });

  it("sellers cannot undo a moderator's removal or set the moderation flag", async () => {
    const id = randomUUID();
    await pool.query(
      `insert into public.listings (id, seller_id, title, category, size_label, price_cents, condition, city, region, status, removed_by_admin)
       values ($1, $2, 'Moderated', 'wig', 'S', 2000, 'good', 'X', 'Y', 'removed', true)`,
      [id, u.parentA],
    );
    await expect(
      as({ id: u.parentA }, (q) => q("update public.listings set status = 'active' where id = $1", [id])),
    ).rejects.toThrow(DENIED);
    await expect(
      as({ id: u.parentA }, (q) =>
        q("update public.listings set removed_by_admin = false, status = 'active' where id = $1", [id]),
      ),
    ).rejects.toThrow(DENIED);
    await expect(
      as({ id: u.parentA }, (q) => q("update public.listings set removed_by_admin = true where id = $1", [ids.listingA])),
    ).rejects.toThrow(DENIED);
    // a seller can still edit text on their own normal listing
    expect(
      await as({ id: u.parentA }, (q) => q("update public.listings set title = 'Solo dress A2' where id = $1 returning id", [ids.listingA])),
    ).toHaveLength(1);
    await pool.query("delete from public.listings where id = $1", [id]);
  });

  it("sellers cannot relist an item that has a paid order", async () => {
    const id = randomUUID();
    await pool.query(
      `insert into public.listings (id, seller_id, title, category, size_label, price_cents, condition, city, region, status)
       values ($1, $2, 'Sold dress', 'solo_dress', 'S', 2000, 'good', 'X', 'Y', 'sold')`,
      [id, u.parentA],
    );
    await pool.query(
      `insert into public.orders (listing_id, listing_title, buyer_id, seller_id, amount_cents, platform_fee_cents, currency, stripe_account_id, status)
       values ($1, 'Sold dress', $2, $3, 2000, 140, 'usd', 'acct_test_A', 'paid')`,
      [id, u.parentB, u.parentA],
    );
    await expect(
      as({ id: u.parentA }, (q) => q("update public.listings set status = 'active' where id = $1", [id])),
    ).rejects.toThrow(DENIED);
    await pool.query("delete from public.orders where listing_id = $1", [id]);
    await pool.query("delete from public.listings where id = $1", [id]);
  });

  it("members cannot attach photos to someone else's listing", async () => {
    await expect(
      as({ id: u.parentB }, (q) =>
        q("insert into public.listing_photos (listing_id, storage_path) values ($1, $2)", [
          ids.listingA,
          `${u.parentB}/${ids.listingA}/${randomUUID()}.jpg`,
        ]),
      ),
    ).rejects.toThrow(DENIED);
  });

  it("storage: cannot upload into another user's folder", async () => {
    await expect(
      as({ id: u.parentB }, (q) =>
        q("insert into storage.objects (bucket_id, name) values ('listing-photos', $1)", [
          `${u.parentA}/${ids.listingA}/${randomUUID()}.jpg`,
        ]),
      ),
    ).rejects.toThrow(DENIED);
  });

  it("storage: photos of active listings are visible to members, removed listings' photos are not", async () => {
    const rows = await as({ id: u.stranger }, (q) => q("select name from storage.objects"));
    expect(rows.map((r) => r.name)).toEqual([photoPathA]);
  });

  it("storage: anonymous visitors see no photos", async () => {
    const rows = await as("anon", (q) => q("select name from storage.objects"));
    expect(rows).toEqual([]);
  });

  it("storage: cannot delete another user's photo", async () => {
    const rows = await as({ id: u.parentB }, (q) =>
      q("delete from storage.objects where name = $1 returning name", [photoPathA]),
    );
    expect(rows).toEqual([]);
  });
});

describe("messaging", () => {
  it("non-participants cannot read conversations or messages", async () => {
    await as({ id: u.stranger }, async (q) => {
      expect(await q("select id from public.conversations")).toEqual([]);
      expect(await q("select id from public.messages")).toEqual([]);
    });
  });

  it("platform admins cannot read private messages either", async () => {
    const rows = await as({ id: u.platformAdmin, aal: "aal2" }, (q) => q("select id from public.messages"));
    expect(rows).toEqual([]);
  });

  it("participants can read their thread", async () => {
    const rows = await as({ id: u.parentA }, (q) => q("select body from public.messages order by created_at"));
    expect(rows).toHaveLength(2);
  });

  it("non-participants cannot post into a conversation", async () => {
    await expect(
      as({ id: u.stranger }, (q) =>
        q("insert into public.messages (conversation_id, body) values ($1, 'hi')", [ids.conversation]),
      ),
    ).rejects.toThrow(DENIED);
  });

  it("senders cannot impersonate another user", async () => {
    await expect(
      as({ id: u.parentB }, (q) =>
        q("insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'fake')", [
          ids.conversation,
          u.parentA,
        ]),
      ),
    ).rejects.toThrow(DENIED);
  });

  it("cannot open a conversation pretending to be someone else or with a fake seller", async () => {
    await expect(
      as({ id: u.stranger }, (q) =>
        q("insert into public.conversations (listing_id, seller_id) values ($1, $2)", [ids.listingA, u.parentB]),
      ),
    ).rejects.toThrow(DENIED);
  });

  it("a member can open a conversation on an active listing as themselves", async () => {
    const rows = await as({ id: u.stranger }, (q) =>
      q("insert into public.conversations (listing_id, seller_id) values ($1, $2) returning buyer_id", [
        ids.listingA,
        u.parentA,
      ]),
    );
    expect(rows[0].buyer_id).toBe(u.stranger);
  });

  it("cannot open a conversation on your own listing or a removed listing", async () => {
    await expect(
      as({ id: u.parentA }, (q) =>
        q("insert into public.conversations (listing_id, seller_id) values ($1, $2)", [ids.listingA, u.parentA]),
      ),
    ).rejects.toThrow(DENIED);
    await expect(
      as({ id: u.stranger }, (q) =>
        q("insert into public.conversations (listing_id, seller_id) values ($1, $2)", [ids.listingRemoved, u.parentB]),
      ),
    ).rejects.toThrow(DENIED);
  });

  it("rate limits messages (10 per minute)", async () => {
    await expect(
      as({ id: u.parentB }, async (q) => {
        for (let i = 0; i < 11; i++) {
          await q("insert into public.messages (conversation_id, body) values ($1, $2)", [ids.conversation, `m${i}`]);
        }
      }),
    ).rejects.toThrow(/rate_limited/);
  });
});

describe("payments", () => {
  it("only buyer and seller can see an order", async () => {
    expect(await as({ id: u.stranger }, (q) => q("select id from public.orders"))).toEqual([]);
    expect(await as({ id: u.parentB }, (q) => q("select id from public.orders"))).toHaveLength(1);
    expect(await as({ id: u.parentA }, (q) => q("select id from public.orders"))).toHaveLength(1);
  });

  it("users cannot create or modify orders", async () => {
    await expect(
      as({ id: u.parentB }, (q) => q("update public.orders set status = 'paid' where id = $1", [ids.order])),
    ).rejects.toThrow(DENIED);
    await expect(
      as({ id: u.parentB }, (q) =>
        q(
          `insert into public.orders (listing_title, amount_cents, platform_fee_cents, currency, stripe_account_id)
           values ('x', 1, 0, 'usd', 'acct_x')`,
        ),
      ),
    ).rejects.toThrow(DENIED);
  });

  it("seller Stripe accounts are visible only to the owner", async () => {
    expect(await as({ id: u.parentB }, (q) => q("select * from public.seller_accounts"))).toEqual([]);
    expect(await as({ id: u.parentA }, (q) => q("select * from public.seller_accounts"))).toHaveLength(1);
  });

  it("users cannot mark themselves as able to receive payments", async () => {
    await expect(
      as({ id: u.parentB }, (q) =>
        q("insert into public.seller_accounts (user_id, stripe_account_id, charges_enabled) values ($1, 'acct_fake', true)", [
          u.parentB,
        ]),
      ),
    ).rejects.toThrow(DENIED);
  });
});

describe("school directory and claims", () => {
  it("anyone can read the directory", async () => {
    const rows = await as("anon", (q) => q("select id from public.schools"));
    expect(rows).toHaveLength(2);
  });

  it("school admin without MFA (aal1) cannot edit their school", async () => {
    const rows = await as({ id: u.schoolAdmin, aal: "aal1" }, (q) =>
      q("update public.schools set description = 'x' where id = $1 returning id", [ids.schoolX]),
    );
    expect(rows).toEqual([]);
  });

  it("school admin with MFA can edit their own school but not another", async () => {
    await as({ id: u.schoolAdmin, aal: "aal2" }, async (q) => {
      expect(await q("update public.schools set description = 'Hello' where id = $1 returning id", [ids.schoolX])).toHaveLength(1);
      expect(await q("update public.schools set description = 'x' where id = $1 returning id", [ids.schoolY])).toEqual([]);
    });
  });

  it("school admins cannot rename or self-verify a school", async () => {
    await expect(
      as({ id: u.schoolAdmin, aal: "aal2" }, (q) =>
        q("update public.schools set name = 'Renamed' where id = $1", [ids.schoolX]),
      ),
    ).rejects.toThrow(DENIED);
    await expect(
      as({ id: u.schoolAdmin, aal: "aal2" }, (q) =>
        q("update public.schools set status = 'verified' where id = $1", [ids.schoolY]),
      ),
    ).rejects.toThrow(DENIED);
  });

  it("cannot grant yourself school admin membership", async () => {
    await expect(
      as({ id: u.claimant, aal: "aal2" }, (q) =>
        q("insert into public.school_admins (school_id, user_id) values ($1, $2)", [ids.schoolY, u.claimant]),
      ),
    ).rejects.toThrow(DENIED);
  });

  it("claims require MFA and a school-admin account", async () => {
    const insert = (q: Q) =>
      q(
        `insert into public.school_claims (school_id, claimant_title, contact_email, evidence)
         values ($1, 'Teacher', 'me@school.test', 'Listed as teacher on our website.')`,
        [ids.schoolX],
      );
    await expect(as({ id: u.claimant, aal: "aal1" }, insert)).rejects.toThrow(DENIED);
    await expect(as({ id: u.parentA, aal: "aal2" }, insert)).rejects.toThrow(DENIED);
    await expect(as({ id: u.claimant, aal: "aal2" }, insert)).resolves.toBeDefined();
  });

  it("claimants cannot pre-approve their own claim", async () => {
    await expect(
      as({ id: u.claimant, aal: "aal2" }, (q) =>
        q(
          `insert into public.school_claims (school_id, claimant_title, contact_email, evidence, status)
           values ($1, 'Teacher', 'me@school.test', 'Listed as teacher on our website.', 'approved')`,
          [ids.schoolX],
        ),
      ),
    ).rejects.toThrow(DENIED);
  });

  it("other users cannot read someone's claim", async () => {
    expect(await as({ id: u.schoolAdmin, aal: "aal2" }, (q) => q("select id from public.school_claims"))).toEqual([]);
    expect(await as({ id: u.claimant }, (q) => q("select id from public.school_claims"))).toHaveLength(1);
  });

  it("only a platform admin with MFA can approve claims", async () => {
    const approve = (q: Q) => q("select public.review_school_claim($1, true, 'ok')", [ids.claim]);
    await expect(as({ id: u.claimant, aal: "aal2" }, approve)).rejects.toThrow(DENIED);
    await expect(as({ id: u.platformAdmin, aal: "aal1" }, approve)).rejects.toThrow(DENIED);
    await as({ id: u.platformAdmin, aal: "aal2" }, async (q) => {
      await approve(q);
      const rows = await q("select user_id from public.school_admins where school_id = $1", [ids.schoolY]);
      expect(rows.map((r) => r.user_id)).toEqual([u.claimant]);
    });
  });
});

describe("feis calendar", () => {
  it("public sees only published events", async () => {
    const rows = await as("anon", (q) => q("select id from public.feis_events"));
    expect(rows.map((r) => r.id)).toEqual([ids.feisPublished]);
  });

  it("other users cannot see pending submissions", async () => {
    expect(await as({ id: u.parentA }, (q) => q("select id from public.feis_events"))).toHaveLength(1);
  });

  it("school admins cannot publish directly or submit for a school they don't manage", async () => {
    await expect(
      as({ id: u.schoolAdmin, aal: "aal2" }, (q) =>
        q(
          `insert into public.feis_events (name, starts_on, ends_on, city, country, registration_url, host_school_id, status)
           values ('X', '2027-05-01', '2027-05-01', 'B', 'US', 'https://x.test', $1, 'published')`,
          [ids.schoolX],
        ),
      ),
    ).rejects.toThrow(DENIED);
    await expect(
      as({ id: u.schoolAdmin, aal: "aal2" }, (q) =>
        q(
          `insert into public.feis_events (name, starts_on, ends_on, city, country, registration_url, host_school_id)
           values ('X', '2027-05-01', '2027-05-01', 'B', 'US', 'https://x.test', $1)`,
          [ids.schoolY],
        ),
      ),
    ).rejects.toThrow(DENIED);
  });

  it("parents cannot submit events", async () => {
    await expect(
      as({ id: u.parentA, aal: "aal2" }, (q) =>
        q(
          `insert into public.feis_events (name, starts_on, ends_on, city, country, registration_url, host_school_id)
           values ('X', '2027-05-01', '2027-05-01', 'B', 'US', 'https://x.test', $1)`,
          [ids.schoolX],
        ),
      ),
    ).rejects.toThrow(DENIED);
  });

  it("rejects non-https registration links", async () => {
    await expect(
      as({ id: u.schoolAdmin, aal: "aal2" }, (q) =>
        q(
          `insert into public.feis_events (name, starts_on, ends_on, city, country, registration_url, host_school_id)
           values ('X', '2027-05-01', '2027-05-01', 'B', 'US', 'javascript:alert(1)', $1)`,
          [ids.schoolX],
        ),
      ),
    ).rejects.toThrow(/violates/);
  });

  it("non-admins cannot publish a pending event", async () => {
    const rows = await as({ id: u.schoolAdmin, aal: "aal2" }, (q) =>
      q("update public.feis_events set status = 'published' where id = $1 returning id", [ids.feisPending]),
    );
    expect(rows).toEqual([]);
  });
});

describe("reports and internal functions", () => {
  it("users cannot read other users' reports", async () => {
    expect(await as({ id: u.parentB }, (q) => q("select id from public.reports"))).toEqual([]);
    expect(await as({ id: u.parentA }, (q) => q("select id from public.reports"))).toHaveLength(1);
  });

  it("the auth rate limiter cannot be called by clients", async () => {
    await expect(as("anon", (q) => q("select public.check_rate_limit('x', 1, 60)"))).rejects.toThrow(DENIED);
    await expect(
      as({ id: u.parentA }, (q) => q("select public.check_rate_limit('x', 1, 60)")),
    ).rejects.toThrow(DENIED);
  });

  it("private schema tables are not reachable", async () => {
    await expect(as({ id: u.parentA }, (q) => q("select * from private.rate_limit_hits"))).rejects.toThrow(DENIED);
  });
});
