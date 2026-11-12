import { api } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { listCandidates } from "@/lib/admin/service";

/** GET /api/admin/candidates — candidates with verification state. Public fields only; private fields need the audited decrypt endpoint. */
export default api({
  GET: async (req, res) => {
    await requireRole(req, res, "admin");
    const rows = await listCandidates();
    res.status(200).json({
      candidates: rows.map((c) => ({
        id: c.id,
        displayCode: c.displayCode,
        name: c.name,
        position: c.position,
        verified: c.verified,
        verifiedAt: c.verifiedAt?.toISOString() ?? null,
        email: c.user.email,
        profileScore: c.profileScore,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  },
});
