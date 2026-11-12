import { z } from "zod";
import { api, parseQuery } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { getThreadDetail } from "@/lib/messaging/threads";

const querySchema = z.object({ threadId: z.string().min(1) });

/** GET /api/threads/detail?threadId= — one conversation with its messages. Reading marks the other side's messages read. */
export default api({
  GET: async (req, res) => {
    const ctx = await requireAuth(req, res);
    const q = parseQuery(req, querySchema);
    const detail = await getThreadDetail(ctx.user.id, q.threadId);
    res.status(200).json(detail);
  },
});
