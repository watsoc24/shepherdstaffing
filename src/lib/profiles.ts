/**
 * M3 Profiles — the only sanctioned path to the encrypted profile columns.
 *
 * Callers never touch `*Enc` ciphertext directly: this module decrypts on
 * read and re-encrypts on write, binding each field name as AAD (see
 * lib/security/crypto.ts). Plaintext private fields are never sent to AI,
 * never put in a public listing, and `familyNotes` is recruiter-only — it is
 * not returned by the candidate's own public view either.
 *
 * The module is pure: it takes plain row objects and returns plain values,
 * so the score math is unit-testable without a database.
 */

import { decryptOptional, encryptOptional } from "./security/crypto";

export type Visibility = "public" | "hidden";

/** Plaintext shape of a candidate profile, as the owner sees it on their own page. */
export type CandidateProfile = {
  id: string;
  displayCode: string;
  name: string | null;
  position: string | null;
  theology: string | null;
  yearsExp: number | null;
  currentRole: string | null;
  geoPreference: string | null;
  relocation: string | null;
  salaryRange: string | null;
  philosophy: string | null;
  strengths: string | null;
  callingNotes: string | null;
  nonNegotiables: string | null;
  privateNotes: string | null;
  familyNotes: string | null;
  visibility: Visibility;
  verified: boolean;
  profileScore: number;
};

/** Plaintext shape of a church profile, as the church sees it on its own page. */
export type ChurchProfile = {
  id: string;
  displayCode: string;
  name: string | null;
  city: string | null;
  region: string | null;
  denomination: string | null;
  theology: string | null;
  size: string | null;
  stage: string | null;
  position: string | null;
  salaryRange: string | null;
  timeline: string | null;
  culture: string | null;
  mustHave: string | null;
  niceToHave: string | null;
  whyHere: string | null;
  dealBreakers: string | null;
  visibility: Visibility;
  profileScore: number;
};

/** What another user may see of a candidate: public fields only, no private notes. */
export type CandidatePublicView = Omit<CandidateProfile, "callingNotes" | "nonNegotiables" | "privateNotes" | "familyNotes">;

/** What another user may see of a church: public fields only, no deal-breakers. */
export type ChurchPublicView = Omit<ChurchProfile, "dealBreakers">;

/** Minimal row shape the decryptors need — mirrors the Prisma models, no DB import. */
type CandidateRow = {
  id: string; displayCode: string;
  name: string | null; position: string | null; theology: string | null;
  yearsExp: number | null; currentRole: string | null; geoPreference: string | null;
  relocation: string | null; salaryRange: string | null; philosophy: string | null;
  strengths: string | null;
  callingNotesEnc: string | null; nonNegotiablesEnc: string | null;
  privateNotesEnc: string | null; familyNotesEnc: string | null;
  visibility: Visibility; verified: boolean; profileScore: number;
};

type ChurchRow = {
  id: string; displayCode: string;
  name: string | null; city: string | null; region: string | null;
  denomination: string | null; theology: string | null; size: string | null;
  stage: string | null; position: string | null; salaryRange: string | null;
  timeline: string | null; culture: string | null; mustHave: string | null;
  niceToHave: string | null; whyHere: string | null; dealBreakerEnc: string | null;
  visibility: Visibility; profileScore: number;
};

export function decryptCandidate(row: CandidateRow): CandidateProfile {
  return {
    id: row.id, displayCode: row.displayCode,
    name: row.name, position: row.position, theology: row.theology,
    yearsExp: row.yearsExp, currentRole: row.currentRole, geoPreference: row.geoPreference,
    relocation: row.relocation, salaryRange: row.salaryRange,
    philosophy: row.philosophy, strengths: row.strengths,
    callingNotes: decryptOptional(row.callingNotesEnc, "callingNotesEnc"),
    nonNegotiables: decryptOptional(row.nonNegotiablesEnc, "nonNegotiablesEnc"),
    privateNotes: decryptOptional(row.privateNotesEnc, "privateNotesEnc"),
    familyNotes: decryptOptional(row.familyNotesEnc, "familyNotesEnc"),
    visibility: row.visibility, verified: row.verified, profileScore: row.profileScore,
  };
}

export function decryptChurch(row: ChurchRow): ChurchProfile {
  return {
    id: row.id, displayCode: row.displayCode,
    name: row.name, city: row.city, region: row.region,
    denomination: row.denomination, theology: row.theology, size: row.size,
    stage: row.stage, position: row.position, salaryRange: row.salaryRange,
    timeline: row.timeline, culture: row.culture, mustHave: row.mustHave,
    niceToHave: row.niceToHave, whyHere: row.whyHere,
    dealBreakers: decryptOptional(row.dealBreakerEnc, "dealBreakerEnc"),
    visibility: row.visibility, profileScore: row.profileScore,
  };
}

export function publicCandidateView(p: CandidateProfile): CandidatePublicView {
  const { callingNotes: _c, nonNegotiables: _n, privateNotes: _p, familyNotes: _f, ...rest } = p;
  void _c; void _n; void _p; void _f;
  return rest;
}

export function publicChurchView(p: ChurchProfile): ChurchPublicView {
  const { dealBreakers: _d, ...rest } = p;
  void _d;
  return rest;
}

/** Plaintext private fields in, ciphertext out. Used by the PUT routes before `update()`. */
export function encryptCandidatePrivate(input: {
  callingNotes?: string | null;
  nonNegotiables?: string | null;
  privateNotes?: string | null;
  familyNotes?: string | null;
}) {
  return {
    callingNotesEnc: encryptOptional(input.callingNotes, "callingNotesEnc"),
    nonNegotiablesEnc: encryptOptional(input.nonNegotiables, "nonNegotiablesEnc"),
    privateNotesEnc: encryptOptional(input.privateNotes, "privateNotesEnc"),
    familyNotesEnc: encryptOptional(input.familyNotes, "familyNotesEnc"),
  };
}

export function encryptChurchPrivate(input: { dealBreakers?: string | null }) {
  return { dealBreakerEnc: encryptOptional(input.dealBreakers, "dealBreakerEnc") };
}

/** Completeness score, 0–100: one point per filled content field. Visibility is not scored. */
const CANDIDATE_SCORE_FIELDS: (keyof Pick<CandidateProfile,
  "name" | "position" | "theology" | "yearsExp" | "currentRole" | "geoPreference" |
  "relocation" | "salaryRange" | "philosophy" | "strengths" |
  "callingNotes" | "nonNegotiables" | "privateNotes" | "familyNotes">)[] = [
  "name", "position", "theology", "yearsExp", "currentRole", "geoPreference",
  "relocation", "salaryRange", "philosophy", "strengths",
  "callingNotes", "nonNegotiables", "privateNotes", "familyNotes",
];

const CHURCH_SCORE_FIELDS: (keyof Pick<ChurchProfile,
  "name" | "city" | "region" | "denomination" | "theology" | "size" | "stage" |
  "position" | "salaryRange" | "timeline" | "culture" | "mustHave" | "niceToHave" |
  "whyHere" | "dealBreakers">)[] = [
  "name", "city", "region", "denomination", "theology", "size", "stage",
  "position", "salaryRange", "timeline", "culture", "mustHave", "niceToHave",
  "whyHere", "dealBreakers",
];

function completeness<T extends Record<string, unknown>>(profile: T, fields: (keyof T)[]): number {
  const filled = fields.filter((f) => {
    const v = profile[f];
    return v !== null && v !== undefined && v !== "";
  }).length;
  return Math.round((filled / fields.length) * 100);
}

export const computeCandidateScore = (p: CandidateProfile) => completeness(p, CANDIDATE_SCORE_FIELDS);
export const computeChurchScore = (p: ChurchProfile) => completeness(p, CHURCH_SCORE_FIELDS);
