import { api } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { listConsents } from "@/lib/compliance/account";

/** GET /api/account/consents — the consent versions you have accepted, and when. */
export default api({
  GET: async (req, res) => {
    const ctx = await requireAuth(req, res);
    const rows = await listConsents(ctx.user.id);
    res.status(200).json({ consents: rows });
  },
});
