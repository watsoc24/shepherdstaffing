import { z } from "zod";
import { api, parseBody } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { text } from "@/lib/security/sanitize";
import { evaluateInterview } from "@/lib/interview/service";

const schema = z.object({
  interviewId: z.string().min(1),
  scores: z.record(z.string(), z.number().int().min(0).max(4)),
  notes: z.record(z.string(), text(1000)).default({}),
  recruiterNotes: text(2000).nullable().default(null),
});

/** POST /api/interviews/evaluate — recruiter (admin) scores a submitted interview, 0–4 per question. The score is the rubric, not a model. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireRole(req, res, "admin");
    const body = parseBody(req, schema);
    const result = await evaluateInterview({
      adminUserId: ctx.user.id,
      interviewId: body.interviewId,
      scores: body.scores,
      notes: body.notes,
      recruiterNotes: body.recruiterNotes,
    });
    res.status(200).json({ ok: true, ...result });
  },
});
