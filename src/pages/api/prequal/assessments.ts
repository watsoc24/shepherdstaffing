import { z } from "zod";
import { api, parseQuery } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { candidates, churches, prequal } from "@/lib/db";
import { forbidden } from "@/lib/api/errors";

const querySchema = z.object({
  recommendation: z.enum(["advance", "review", "not_advancing"]).optional(),
  take: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * GET /api/prequal/assessments — the hiring team's read path.
 * Churches see only assessments submitted for their church (churchId match),
 * including the applicant's email so they can follow up — that is the point
 * of applying. Candidates see only their own assessments. Admins are not
 * served here yet (admin tooling is M8); this is deliberately narrow.
 */
export default api({
  GET: async (req, res) => {
    const ctx = await requireAuth(req, res);
    const q = parseQuery(req, querySchema);
    const take = q.take ?? 50;

    if (ctx.user.role === "church") {
      const church = await churches.findByUserId(ctx.user.id);
      if (!church) return res.status(200).json({ assessments: [] });
      const rows = await prequal.listForChurch(church.id, { take });
      return res.status(200).json({ assessments: rows.filter((r) => !q.recommendation || r.recommendation === q.recommendation).map(publicRow) });
    }
    if (ctx.user.role === "candidate") {
      const candidate = await candidates.findByUserId(ctx.user.id);
      if (!candidate) return res.status(200).json({ assessments: [] });
      const rows = await prequal.listForCandidate(candidate.id, { take });
      return res.status(200).json({ assessments: rows.filter((r) => !q.recommendation || r.recommendation === q.recommendation).map(publicRow) });
    }
    throw forbidden("PreQual assessments are shown to churches and candidates.");
  },
});

type Row = Awaited<ReturnType<typeof prequal.listForChurch>>[number];

function publicRow(r: Row) {
  return {
    id: r.id,
    applicantName: r.applicantName,
    applicantEmail: r.applicantEmail,
    role: r.role,
    score: r.score,
    breakdown: r.breakdown,
    recommendation: r.recommendation,
    knockoutFailed: r.knockoutFailed,
    flags: r.flags,
    createdAt: r.createdAt,
  };
}
