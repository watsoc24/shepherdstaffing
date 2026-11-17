import { api, limit } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { buildExport } from "@/lib/compliance/account";

/** POST /api/account/export — download everything we hold about you, as JSON. Secrets stripped; your own private fields decrypted. Audited. */
export default api({
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    await limit("accountExport", `user:${ctx.user.id}`);
    const data = await buildExport(ctx.user.id);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="fit-for-ministry-export-${ctx.user.id}.json"`);
    res.status(200).json(data);
  },
});
