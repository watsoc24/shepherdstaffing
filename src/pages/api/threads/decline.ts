import { z } from "zod";
import { api, parseBody } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { respondToThread } from "@/lib/messaging/threads";

const schema = z.object({ threadId: z.string().min(1) });

/** POST /api/threads/decline — the recipient declines a contact request. The thread can be re-requested later. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    const body = parseBody(req, schema);
    await respondToThread({ userId: ctx.user.id, threadId: body.threadId, accept: false });
    res.status(200).json({ ok: true });
  },
});
