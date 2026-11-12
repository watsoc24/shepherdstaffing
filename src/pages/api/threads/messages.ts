import { z } from "zod";
import { api, limit, parseBody } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { messageText } from "@/lib/security/sanitize";
import { sendReply } from "@/lib/messaging/threads";

const schema = z.object({ threadId: z.string().min(1), body: messageText });

/** POST /api/threads/messages — write in an accepted thread. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    await limit("messaging", `user:${ctx.user.id}`);
    const body = parseBody(req, schema);
    const result = await sendReply({ userId: ctx.user.id, threadId: body.threadId, body: body.body });
    res.status(201).json({ ok: true, ...result });
  },
});
