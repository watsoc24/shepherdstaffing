import { z } from "zod";
import { api, limit, parseBody } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { text } from "@/lib/security/sanitize";
import { saveAnswers } from "@/lib/interview/service";

const schema = z.object({
  interviewId: z.string().min(1),
  answers: z.record(z.string(), text(2000)),
});

/** POST /api/interviews/answers — save draft answers. Encrypted at rest; drafts only. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    await limit("interviewSave", `user:${ctx.user.id}`);
    const body = parseBody(req, schema);
    await saveAnswers(ctx.user.id, body.interviewId, body.answers);
    res.status(200).json({ ok: true });
  },
});
