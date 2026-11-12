import { api } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { getOwnInterview } from "@/lib/interview/service";

/** GET /api/interviews — the candidate's latest interview, with their own answers and the churches they may share it with. */
export default api({
  GET: async (req, res) => {
    const ctx = await requireAuth(req, res);
    const result = await getOwnInterview(ctx.user.id);
    res.status(200).json(result);
  },
});
