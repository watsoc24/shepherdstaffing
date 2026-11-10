import { z } from "zod";
import { api, clientIp, limit, parseBody } from "@/lib/api/handler";
import { forgotPassword } from "@/lib/auth/service";
import { emailField } from "@/lib/security/sanitize";

export default api({
  POST: async (req, res) => {
    const ip = clientIp(req);
    await limit("forgotPassword", `ip:${ip}`);
    const { email } = parseBody(req, z.object({ email: emailField }));
    await limit("forgotPassword", `email:${email}`);
    await forgotPassword(email, ip);
    // Identical response whether or not the account exists.
    res.json({ ok: true, message: "If that email has an account, a reset link is on its way." });
  },
});
