import { db } from "./client";
import { pick } from "./pick";
import { randomCode } from "../security/crypto";

export const CHURCH_PUBLIC_FIELDS = [
  "name",
  "city",
  "region",
  "denomination",
  "theology",
  "size",
  "stage",
  "position",
  "salaryRange",
  "timeline",
  "culture",
  "mustHave",
  "niceToHave",
  "whyHere",
  "visibility",
] as const;

export const CHURCH_ENCRYPTED_FIELDS = ["dealBreakerEnc"] as const;

type Writable = Partial<Record<(typeof CHURCH_PUBLIC_FIELDS)[number] | (typeof CHURCH_ENCRYPTED_FIELDS)[number], unknown>> & {
  profileScore?: number;
};

export const findById = (id: string) => db().church.findUnique({ where: { id } });
export const findByUserId = (userId: string) => db().church.findUnique({ where: { userId } });

export async function createForUser(userId: string, name: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db().church.create({ data: { userId, name, displayCode: randomCode(6) } });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002" || attempt === 4) throw e;
    }
  }
  throw new Error("unreachable");
}

export function update(id: string, data: Writable) {
  const safe = pick(data, [...CHURCH_PUBLIC_FIELDS, ...CHURCH_ENCRYPTED_FIELDS, "profileScore"] as const);
  return db().church.update({ where: { id }, data: safe as never });
}

export const listPublic = (opts: { position?: string; take?: number; skip?: number } = {}) =>
  db().church.findMany({
    where: { visibility: "public", position: opts.position, user: { deletedAt: null, deactivatedAt: null, emailVerified: true } },
    orderBy: { profileScore: "desc" },
    take: opts.take ?? 50,
    skip: opts.skip ?? 0,
  });
