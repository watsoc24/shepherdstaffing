import { z } from "zod";
import { api, clientIp, limit, parseBody } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { changePassword } from "@/lib/auth/service";

export default api({
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    await limit("login", `user:${ctx.user.id}`);
    const { currentPassword, newPassword } = parseBody(
      req,
      z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().max(200) }),
    );
    await changePassword(ctx.user, currentPassword, newPassword, clientIp(req), res);
    res.json({ ok: true });
  },
});
