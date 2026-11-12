import { z } from "zod";
import { api, parseQuery } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { listReports } from "@/lib/admin/service";

const querySchema = z.object({ status: z.enum(["open", "reviewed", "actioned"]).optional() });

/** GET /api/admin/reports — the moderation queue. Admin only. */
export default api({
  GET: async (req, res) => {
    await requireRole(req, res, "admin");
    const q = parseQuery(req, querySchema);
    const rows = await listReports(q.status);
    res.status(200).json({ reports: rows });
  },
});
