import { z } from "zod";
import { api, clientIp, limit, parseBody } from "@/lib/api/handler";
import { resendVerification } from "@/lib/auth/service";
import { emailField } from "@/lib/security/sanitize";

export default api({
  POST: async (req, res) => {
    const ip = clientIp(req);
    await limit("verify", `ip:${ip}`);
    const { email } = parseBody(req, z.object({ email: emailField }));
    await limit("verify", `email:${email}`);
    await resendVerification(email);
    res.json({ ok: true, message: "If that account needs confirming, we've sent a new link." });
  },
});
