import { z } from "zod";
import { api, parseBody } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { requestDeletion } from "@/lib/compliance/account";

const schema = z.object({ confirm: z.literal("DELETE") });

/**
 * POST /api/account/delete — close your account. Body must say exactly
 * "DELETE". An active paid subscription must be cancelled first.
 * Soft delete: sessions revoked now, personal data purged within 30 days.
 */
export default api({
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    parseBody(req, schema);
    await requestDeletion(ctx.user.id);
    res.status(200).json({ ok: true });
  },
});
