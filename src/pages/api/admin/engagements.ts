import { api } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { listEngagements } from "@/lib/admin/service";

/** GET /api/admin/engagements — the assisted/full pipeline. Admin only. */
export default api({
  GET: async (req, res) => {
    await requireRole(req, res, "admin");
    const rows = await listEngagements();
    res.status(200).json({ engagements: rows });
  },
});
