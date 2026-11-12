import { z } from "zod";
import { api, parseBody } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { changeUserRole } from "@/lib/admin/service";

const schema = z.object({ userId: z.string().min(1), role: z.enum(["candidate", "church", "admin"]) });

/** POST /api/admin/role — change an account's role. You cannot change your own. Audited. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireRole(req, res, "admin");
    const body = parseBody(req, schema);
    await changeUserRole(ctx.user.id, body.userId, body.role);
    res.status(200).json({ ok: true });
  },
});
