import { z } from "zod";
import { api, parseBody } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { verifyCandidate } from "@/lib/admin/service";

const schema = z.object({ candidateId: z.string().min(1), verified: z.boolean() });

/** POST /api/admin/verify-candidate — verify (or unverify) a candidate. Audited; verification is admin-only by design. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireRole(req, res, "admin");
    const body = parseBody(req, schema);
    await verifyCandidate(ctx.user.id, body.candidateId, body.verified);
    res.status(200).json({ ok: true });
  },
});
