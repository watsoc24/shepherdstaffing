import { z } from "zod";
import { api, parseBody } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { setSharing } from "@/lib/interview/service";

const schema = z.object({ interviewId: z.string().min(1), churchIds: z.array(z.string().min(1)).max(50) });

/** POST /api/interviews/share — the candidate chooses which matched churches may see the evaluation. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    const body = parseBody(req, schema);
    await setSharing(ctx.user.id, body.interviewId, body.churchIds);
    res.status(200).json({ ok: true });
  },
});
