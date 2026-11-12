import { z } from "zod";
import { api, parseBody } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { extendUserTrial } from "@/lib/admin/service";

const schema = z.object({ userId: z.string().min(1), days: z.number().int().min(1).max(90) });

/** POST /api/admin/extend-trial — add 1–90 days to a trial, from its current end (or today). Audited. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireRole(req, res, "admin");
    const body = parseBody(req, schema);
    await extendUserTrial(ctx.user.id, body.userId, body.days);
    res.status(200).json({ ok: true });
  },
});
