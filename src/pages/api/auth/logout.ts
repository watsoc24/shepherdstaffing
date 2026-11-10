import { api } from "@/lib/api/handler";
import { clearSessionCookie } from "@/lib/auth/session";

export default api({
  POST: async (_req, res) => {
    clearSessionCookie(res);
    res.status(204).end();
  },
});
