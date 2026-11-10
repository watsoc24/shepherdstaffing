import { z } from "zod";
import { api, clientIp, limit, parseBody } from "@/lib/api/handler";
import { publicUser, verifyEmail } from "@/lib/auth/service";

export default api({
  POST: async (req, res) => {
    const ip = clientIp(req);
    await limit("verify", `ip:${ip}`);
    const { token } = parseBody(req, z.object({ token: z.string().min(20).max(200) }));
    const user = await verifyEmail(token, ip, res);
    res.json({ ok: true, user: publicUser(user) });
  },
});
