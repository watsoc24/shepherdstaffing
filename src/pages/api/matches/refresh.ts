import { api, limit } from "@/lib/api/handler";
import { forbidden } from "@/lib/api/errors";
import { requireAuth } from "@/lib/auth/guards";
import { refreshForCandidate, refreshForChurch } from "@/lib/matching/refresh";

/**
 * POST /api/matches/refresh — recompute the signed-in user's matches against
 * public listings on the other side. Re-scoring is cheap (deterministic);
 * LLM narrative is bounded to the top 5 pairs. Rate-limited per user.
 */
export default api({
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    await limit("matchCompute", `user:${ctx.user.id}`);
    if (ctx.user.role === "candidate") {
      const result = await refreshForCandidate(ctx.user.id);
      return res.status(200).json({ ok: true, ...result });
    }
    if (ctx.user.role === "church") {
      const result = await refreshForChurch(ctx.user.id);
      return res.status(200).json({ ok: true, ...result });
    }
    throw forbidden("Matches are computed for candidates and churches.");
  },
});
