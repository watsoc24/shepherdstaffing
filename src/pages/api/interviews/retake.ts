import { z } from "zod";
import { api, parseBody } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { allowInterviewRetake } from "@/lib/interview/service";

const schema = z.object({ interviewId: z.string().min(1) });

/** POST /api/interviews/retake — admin lets a candidate take the interview again. Audited; the previous submission stays on record. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireRole(req, res, "admin");
    const body = parseBody(req, schema);
    await allowInterviewRetake(ctx.user.id, body.interviewId);
    res.status(200).json({ ok: true });
  },
});
