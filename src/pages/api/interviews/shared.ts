import { api } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { requireEntitlement } from "@/lib/billing/entitlements";
import { listSharedForChurch } from "@/lib/interview/service";

/** GET /api/interviews/shared — evaluated interviews shared with this church. Scores and evaluations only, never raw answers. */
export default api({
  GET: async (req, res) => {
    const ctx = await requireAuth(req, res);
    requireEntitlement(ctx, "canViewInterviewResults");
    const rows = await listSharedForChurch(ctx.user.id);
    res.status(200).json({ interviews: rows });
  },
});
