import { z } from "zod";
import { api, parseBody } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { readCandidatePrivate } from "@/lib/admin/service";

const schema = z.object({ candidateId: z.string().min(1) });

/**
 * POST /api/admin/candidates/private — read a candidate's decrypted private
 * fields. Admin only, and the read is written to the audit log. This is
 * the only place an admin may see them.
 */
export default api({
  POST: async (req, res) => {
    const ctx = await requireRole(req, res, "admin");
    const body = parseBody(req, schema);
    const result = await readCandidatePrivate(ctx.user.id, body.candidateId);
    res.status(200).json(result);
  },
});
