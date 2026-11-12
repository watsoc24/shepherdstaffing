import { z } from "zod";
import { api, parseBody } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { resolveReport } from "@/lib/admin/service";

const schema = z.object({ reportId: z.string().min(1), status: z.enum(["open", "reviewed", "actioned"]) });

/** POST /api/admin/reports/resolve — mark a report reviewed or actioned. Audited. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireRole(req, res, "admin");
    const body = parseBody(req, schema);
    await resolveReport(ctx.user.id, body.reportId, body.status);
    res.status(200).json({ ok: true });
  },
});
