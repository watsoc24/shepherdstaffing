import { z } from "zod";
import { api, limit, parseBody } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { submitInterview } from "@/lib/interview/service";

const schema = z.object({ interviewId: z.string().min(1) });

/** POST /api/interviews/submit — submit the interview. Every question must be answered; the draft then locks. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    await limit("interviewSubmit", `user:${ctx.user.id}`);
    const body = parseBody(req, schema);
    await submitInterview(ctx.user.id, body.interviewId);
    res.status(200).json({ ok: true });
  },
});
