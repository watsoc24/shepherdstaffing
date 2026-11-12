import { z } from "zod";
import { api, limit, parseBody } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { churches } from "@/lib/db";
import { nullableText, profileText } from "@/lib/security/sanitize";
import { computeChurchScore, decryptChurch, encryptChurchPrivate } from "@/lib/profiles";

const churchUpdateSchema = z.object({
  name: nullableText(200),
  city: nullableText(200),
  region: nullableText(200),
  denomination: nullableText(200),
  theology: nullableText(200),
  size: nullableText(200),
  stage: nullableText(200),
  position: nullableText(200),
  salaryRange: nullableText(200),
  timeline: nullableText(200),
  culture: profileText.nullable().optional(),
  mustHave: profileText.nullable().optional(),
  niceToHave: profileText.nullable().optional(),
  whyHere: profileText.nullable().optional(),
  dealBreakers: profileText.nullable().optional(),
  visibility: z.enum(["public", "hidden"]).optional(),
});

/**
 * GET /api/profiles/church — the signed-in church's own profile, decrypted.
 * PUT /api/profiles/church — save it. Deal-breakers are encrypted by
 * lib/profiles before they reach the DB; ciphertext is never returned.
 * Profile score is recomputed from completeness on every save.
 */
export default api({
  GET: async (req, res) => {
    const ctx = await requireRole(req, res, "church");
    const row = (await churches.findByUserId(ctx.user.id)) ?? (await churches.createForUser(ctx.user.id, ctx.user.name));
    res.status(200).json({ profile: decryptChurch(row) });
  },
  PUT: async (req, res) => {
    const ctx = await requireRole(req, res, "church");
    await limit("profileUpdate", `user:${ctx.user.id}`);
    const body = parseBody(req, churchUpdateSchema);
    const row = (await churches.findByUserId(ctx.user.id)) ?? (await churches.createForUser(ctx.user.id, ctx.user.name));
    const merged = { ...decryptChurch(row), ...body };
    const score = computeChurchScore(merged);
    const updated = await churches.update(row.id, {
      ...body,
      ...encryptChurchPrivate(body),
      profileScore: score,
    });
    res.status(200).json({ profile: decryptChurch(updated) });
  },
});
