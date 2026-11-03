import { z } from "zod";
import { api, clientIp, limit, parseBody } from "@/lib/api/handler";
import { login, publicUser } from "@/lib/auth/service";
import { emailField } from "@/lib/security/sanitize";
import { getEntitlements } from "@/lib/billing/entitlements";

export default api({
  POST: async (req, res) => {
    const ip = clientIp(req);
    await limit("login", `ip:${ip}`);
    const { email, password } = parseBody(req, z.object({ email: emailField, password: z.string().min(1).max(200) }));
    await limit("login", `email:${email}`);
    const user = await login(email, password, ip, res);
    res.json({ user: publicUser(user), entitlements: await getEntitlements(user.id) });
  },
});
