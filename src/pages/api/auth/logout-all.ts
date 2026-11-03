import { api, clientIp } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { logoutAll } from "@/lib/auth/service";
import { clearSessionCookie } from "@/lib/auth/session";

export default api({
  POST: async (req, res) => {
    const { user } = await requireAuth(req, res, { allowUnverified: true });
    await logoutAll(user, clientIp(req));
    clearSessionCookie(res);
    res.status(204).end();
  },
});
