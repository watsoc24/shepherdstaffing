import { api } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { listUsers } from "@/lib/admin/service";

/** GET /api/admin/users — accounts, newest first. No password hashes or tokens, ever. Admin only. */
export default api({
  GET: async (req, res) => {
    await requireRole(req, res, "admin");
    const rows = await listUsers();
    res.status(200).json({ users: rows });
  },
});
