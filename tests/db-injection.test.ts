import { beforeEach, describe, expect, it } from "vitest";
import { users, inquiries } from "@/lib/db";
import { resetDb } from "./helpers";

/**
 * Defect #2 (Airtable formula injection), Postgres edition: every query goes
 * through Prisma's parameterized API. Hostile strings must be stored and
 * matched literally, never interpreted.
 */
const HOSTILE = [
  `" OR 1=1 --`,
  `'; DROP TABLE "User"; --`,
  `x" ) OR ({Role} = "admin`,
  `\\"; SELECT pg_sleep(5); --`,
  `%`,
  `_`,
  `a@b.com' OR '1'='1`,
  `{Email} = "admin@x.com"`,
];

beforeEach(resetDb);

describe("hostile input through the data layer", () => {
  it("lookups by email match literally and never widen", async () => {
    await users.create({
      email: "real@example.com",
      passwordHash: "x",
      name: "Real",
      role: "candidate",
      verifyTokenHash: "h1",
      verifyTokenExpires: new Date(),
    });
    for (const h of HOSTILE) {
      expect(await users.findByEmail(h)).toBeNull();
      expect(await users.findByVerifyTokenHash(h)).toBeNull();
    }
    expect(await users.findByEmail("REAL@example.com")).not.toBeNull();
  });

  it("stores hostile strings verbatim", async () => {
    for (const [i, h] of HOSTILE.entries()) {
      const row = await inquiries.create({ contactName: h, contactEmail: `x${i}@x.com`, churchName: h, tier: "assisted", notes: h });
      const back = await inquiries.findById(row.id);
      expect(back?.contactName).toBe(h);
      expect(back?.churchName).toBe(h);
    }
    expect((await inquiries.list()).length).toBe(HOSTILE.length);
  });
});
