import { api } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { listAudit } from "@/lib/admin/service";

/** GET /api/admin/audit — the audit trail, newest first. Admin only. Never contains PII or decrypted values. */
export default api({
  GET: async (req, res) => {
    await requireRole(req, res, "admin");
    const rows = await listAudit();
    res.status(200).json({ audit: rows });
  },
});
