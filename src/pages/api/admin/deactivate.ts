import { z } from "zod";
import { api, parseBody } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { deactivateUser } from "@/lib/admin/service";

const schema = z.object({ userId: z.string().min(1) });

/** POST /api/admin/deactivate — deactivate an account and revoke its sessions. You cannot deactivate yourself. Audited. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireRole(req, res, "admin");
    const body = parseBody(req, schema);
    await deactivateUser(ctx.user.id, body.userId);
    res.status(200).json({ ok: true });
  },
});
