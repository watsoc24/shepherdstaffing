import { api } from "@/lib/api/handler";
import { forbidden } from "@/lib/api/errors";
import { requireAuth } from "@/lib/auth/guards";
import { listThreads } from "@/lib/messaging/threads";

/** GET /api/threads — the signed-in user's conversations, newest first. */
export default api({
  GET: async (req, res) => {
    const ctx = await requireAuth(req, res);
    if (ctx.user.role !== "candidate" && ctx.user.role !== "church") {
      throw forbidden("Messages are for candidates and churches.");
    }
    const rows = await listThreads(ctx.user.id, ctx.user.role);
    res.status(200).json({ threads: rows });
  },
});
