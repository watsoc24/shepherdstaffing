import { z } from "zod";
import { api, parseBody } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { convertInquiry } from "@/lib/admin/service";

const schema = z.object({ inquiryId: z.string().min(1) });

/** POST /api/admin/inquiries/convert — turn a won inquiry into an assisted/full engagement. Admin only, audited. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireRole(req, res, "admin");
    const body = parseBody(req, schema);
    const result = await convertInquiry(ctx.user.id, body.inquiryId);
    res.status(201).json({ ok: true, ...result });
  },
});
