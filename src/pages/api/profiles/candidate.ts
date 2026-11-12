import { z } from "zod";
import { api, limit, parseBody } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { candidates } from "@/lib/db";
import { nullableText, profileText } from "@/lib/security/sanitize";
import {
  computeCandidateScore,
  decryptCandidate,
  encryptCandidatePrivate,
} from "@/lib/profiles";

const candidateUpdateSchema = z.object({
  name: nullableText(200),
  position: nullableText(200),
  theology: nullableText(200),
  yearsExp: z.number().int().min(0).max(60).nullable().optional(),
  currentRole: nullableText(200),
  geoPreference: nullableText(200),
  relocation: nullableText(200),
  salaryRange: nullableText(200),
  philosophy: profileText.nullable().optional(),
  strengths: profileText.nullable().optional(),
  callingNotes: profileText.nullable().optional(),
  nonNegotiables: profileText.nullable().optional(),
  privateNotes: profileText.nullable().optional(),
  familyNotes: profileText.nullable().optional(),
  visibility: z.enum(["public", "hidden"]).optional(),
});

/**
 * GET /api/profiles/candidate — the signed-in candidate's own profile, decrypted.
 * PUT /api/profiles/candidate — save it. Private fields are encrypted by
 * lib/profiles before they reach the DB; ciphertext is never returned.
 * Profile score is recomputed from completeness on every save.
 */
export default api({
  GET: async (req, res) => {
    const ctx = await requireRole(req, res, "candidate");
    const row = (await candidates.findByUserId(ctx.user.id)) ?? (await candidates.createForUser(ctx.user.id, ctx.user.name));
    res.status(200).json({ profile: decryptCandidate(row) });
  },
  PUT: async (req, res) => {
    const ctx = await requireRole(req, res, "candidate");
    await limit("profileUpdate", `user:${ctx.user.id}`);
    const body = parseBody(req, candidateUpdateSchema);
    const row = (await candidates.findByUserId(ctx.user.id)) ?? (await candidates.createForUser(ctx.user.id, ctx.user.name));
    const merged = { ...decryptCandidate(row), ...body, yearsExp: body.yearsExp ?? decryptCandidate(row).yearsExp };
    const score = computeCandidateScore(merged);
    const updated = await candidates.update(row.id, {
      ...body,
      ...encryptCandidatePrivate(body),
      profileScore: score,
    });
    res.status(200).json({ profile: decryptCandidate(updated) });
  },
});
