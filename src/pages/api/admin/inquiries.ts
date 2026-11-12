import { z } from "zod";
import { api, parseQuery } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { inquiries } from "@/lib/db";

const querySchema = z.object({
  status: z.enum(["new", "contacted", "scoped", "won", "lost"]).optional(),
  tier: z.enum(["assisted", "full"]).optional(),
});

/** GET /api/admin/inquiries — the intake queue, newest first. Admin only. */
export default api({
  GET: async (req, res) => {
    await requireRole(req, res, "admin");
    const q = parseQuery(req, querySchema);
    const rows = await inquiries.list(q);
    res.status(200).json({ inquiries: rows });
  },
});
