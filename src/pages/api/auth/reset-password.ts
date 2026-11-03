import { z } from "zod";
import { api, clientIp, limit, parseBody } from "@/lib/api/handler";
import { resetPassword } from "@/lib/auth/service";

export default api({
  POST: async (req, res) => {
    const ip = clientIp(req);
    await limit("forgotPassword", `ip:${ip}`);
    const { token, password } = parseBody(req, z.object({ token: z.string().min(20).max(200), password: z.string().max(200) }));
    await resetPassword(token, password, ip);
    res.json({ ok: true, message: "Your password has been updated. Please sign in." });
  },
});
