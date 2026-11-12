import { z } from "zod";
import { api, parseBody } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { text } from "@/lib/security/sanitize";
import { reportThread } from "@/lib/messaging/threads";

const schema = z.object({ threadId: z.string().min(1), reason: text(500).pipe(z.string().min(1, "Please say what happened")) });

/** POST /api/threads/report — report the other party. Held for admin review (M8); reporting does not block or close the thread. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    const body = parseBody(req, schema);
    await reportThread({ userId: ctx.user.id, threadId: body.threadId, reason: body.reason });
    res.status(200).json({ ok: true });
  },
});
