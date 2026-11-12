import { api } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { requireEntitlement } from "@/lib/billing/entitlements";
import { startInterview } from "@/lib/interview/service";

/** POST /api/interviews/start — begin (or return to) the interview draft. Trial members may take it; the consent version is recorded. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    requireEntitlement(ctx, "canTakeInterview");
    const result = await startInterview(ctx.user.id);
    res.status(201).json({ ok: true, ...result });
  },
});
