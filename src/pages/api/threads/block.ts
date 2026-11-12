import { z } from "zod";
import { api, parseBody } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { blockThread } from "@/lib/messaging/threads";

const schema = z.object({ threadId: z.string().min(1) });

/** POST /api/threads/block — block the other party and close the thread. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    const body = parseBody(req, schema);
    await blockThread({ userId: ctx.user.id, threadId: body.threadId });
    res.status(200).json({ ok: true });
  },
});
