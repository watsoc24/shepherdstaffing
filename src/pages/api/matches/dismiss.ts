import { z } from "zod";
import { api, parseBody } from "@/lib/api/handler";
import { notFound } from "@/lib/api/errors";
import { requireAuth } from "@/lib/auth/guards";
import { candidates, churches, matches } from "@/lib/db";

const schema = z.object({ matchId: z.string().min(1) });

/**
 * POST /api/matches/dismiss — hide a match. Only the match's own candidate
 * or church may dismiss it; everyone else gets a 404-shaped refusal.
 */
export default api({
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    const body = parseBody(req, schema);
    // Ownership is checked by scanning the caller's own matches — the
    // composite (candidateId, churchId) key means a bare id lookup is not enough.
    let owned = false;
    if (ctx.user.role === "candidate") {
      const c = await candidates.findByUserId(ctx.user.id);
      if (c) owned = (await matches.forCandidate(c.id)).some((m) => m.id === body.matchId);
    } else if (ctx.user.role === "church") {
      const h = await churches.findByUserId(ctx.user.id);
      if (h) owned = (await matches.forChurch(h.id)).some((m) => m.id === body.matchId);
    }
    if (!owned) throw notFound("Match not found");
    await matches.setStatus(body.matchId, "dismissed");
    res.status(200).json({ ok: true });
  },
});
