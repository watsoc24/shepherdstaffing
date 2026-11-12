import { api } from "@/lib/api/handler";
import { forbidden } from "@/lib/api/errors";
import { requireAuth } from "@/lib/auth/guards";
import { candidates, churches, matches } from "@/lib/db";
import { getEntitlements, requireEntitlement } from "@/lib/billing/entitlements";

/**
 * GET /api/matches — the signed-in user's own matches, best first.
 * Scores are visible on trial and paid plans; the full breakdown, strengths,
 * gaps and recommendation need the detail entitlement (paid, or in trial).
 * The other side is shown by display code and position only — full listings
 * are a separate entitlement, enforced where listings are served.
 */
export default api({
  GET: async (req, res) => {
    const ctx = await requireAuth(req, res);
    const ent = await getEntitlements(ctx.user.id);
    requireEntitlement(ctx, "canSeeMatchScores");
    const detail = ent.canSeeMatchDetail;

    const present = (r: { id: string; score: number; status: string; modelVersion: string; breakdown: unknown; strengths: unknown; gaps: unknown; recommendation: string }, other: { displayCode: string; position: string | null }) => ({
      id: r.id,
      score: r.score,
      status: r.status,
      modelVersion: r.modelVersion,
      other: { displayCode: other.displayCode, position: other.position },
      ...(detail ? { breakdown: r.breakdown, strengths: r.strengths, gaps: r.gaps, recommendation: r.recommendation } : {}),
    });

    if (ctx.user.role === "candidate") {
      const c = await candidates.findByUserId(ctx.user.id);
      if (!c) return res.status(200).json({ matches: [] });
      const rows = await matches.forCandidate(c.id);
      return res.status(200).json({ matches: rows.map((r) => present(r, r.church)) });
    }
    if (ctx.user.role === "church") {
      const h = await churches.findByUserId(ctx.user.id);
      if (!h) return res.status(200).json({ matches: [] });
      const rows = await matches.forChurch(h.id);
      return res.status(200).json({ matches: rows.map((r) => present(r, r.candidate)) });
    }
    throw forbidden("Matches are shown to candidates and churches.");
  },
});
