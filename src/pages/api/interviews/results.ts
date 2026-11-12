import { z } from "zod";
import { api, parseQuery } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { requireEntitlement } from "@/lib/billing/entitlements";
import { getResultForChurch } from "@/lib/interview/service";

const querySchema = z.object({ interviewId: z.string().min(1) });

/** GET /api/interviews/results?interviewId= — one shared evaluation: score, per-question notes, recruiter note. Never the raw answers. */
export default api({
  GET: async (req, res) => {
    const ctx = await requireAuth(req, res);
    requireEntitlement(ctx, "canViewInterviewResults");
    const q = parseQuery(req, querySchema);
    const result = await getResultForChurch(ctx.user.id, q.interviewId);
    res.status(200).json(result);
  },
});
