import { db } from "./client";
import { pick } from "./pick";
import { randomCode } from "../security/crypto";

/** Fields the owner may edit in the public section. */
export const CANDIDATE_PUBLIC_FIELDS = [
  "name",
  "position",
  "theology",
  "yearsExp",
  "currentRole",
  "geoPreference",
  "relocation",
  "salaryRange",
  "philosophy",
  "strengths",
  "visibility",
] as const;

/** Encrypted columns (ciphertext). Written only through lib/profiles. */
export const CANDIDATE_ENCRYPTED_FIELDS = ["callingNotesEnc", "nonNegotiablesEnc", "privateNotesEnc", "familyNotesEnc"] as const;

type Writable = Partial<Record<(typeof CANDIDATE_PUBLIC_FIELDS)[number] | (typeof CANDIDATE_ENCRYPTED_FIELDS)[number], unknown>> & {
  profileScore?: number;
};

export const findById = (id: string) => db().candidate.findUnique({ where: { id } });
export const findByUserId = (userId: string) => db().candidate.findUnique({ where: { userId } });

export async function createForUser(userId: string, name: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db().candidate.create({ data: { userId, name, displayCode: randomCode(6) } });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002" || attempt === 4) throw e;
    }
  }
  throw new Error("unreachable");
}

export function update(id: string, data: Writable) {
  const safe = pick(data, [...CANDIDATE_PUBLIC_FIELDS, ...CANDIDATE_ENCRYPTED_FIELDS, "profileScore"] as const);
  return db().candidate.update({ where: { id }, data: safe as never });
}

export const setVerified = (id: string, verified: boolean, by: string | null) =>
  db().candidate.update({ where: { id }, data: { verified, verifiedBy: verified ? by : null, verifiedAt: verified ? new Date() : null } });

export const listPublic = (opts: { position?: string; take?: number; skip?: number } = {}) =>
  db().candidate.findMany({
    where: { visibility: "public", position: opts.position, user: { deletedAt: null, deactivatedAt: null, emailVerified: true } },
    orderBy: { profileScore: "desc" },
    take: opts.take ?? 50,
    skip: opts.skip ?? 0,
  });
