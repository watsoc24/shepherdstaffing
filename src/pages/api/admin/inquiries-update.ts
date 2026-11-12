import { z } from "zod";
import { api, parseBody } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { updateInquiry } from "@/lib/admin/service";
import { text } from "@/lib/security/sanitize";

const schema = z.object({
  inquiryId: z.string().min(1),
  status: z.enum(["new", "contacted", "scoped", "won", "lost"]).optional(),
  assignedTo: z.string().min(1).nullable().optional(),
  internalNotes: text(2000).nullable().optional(),
});

/** POST /api/admin/inquiries/update — move an inquiry through the pipeline or assign it. Audited. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireRole(req, res, "admin");
    const body = parseBody(req, schema);
    await updateInquiry(ctx.user.id, body.inquiryId, {
      status: body.status,
      assignedTo: body.assignedTo,
      internalNotes: body.internalNotes,
    });
    res.status(200).json({ ok: true });
  },
});
