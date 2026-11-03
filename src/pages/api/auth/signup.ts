import { z } from "zod";
import { api, clientIp, limit, parseBody } from "@/lib/api/handler";
import { signup } from "@/lib/auth/service";
import { emailField, text } from "@/lib/security/sanitize";

const schema = z.object({
  email: emailField,
  password: z.string().max(200),
  name: text(120).pipe(z.string().min(1, "Please enter your name")),
  role: z.enum(["candidate", "church"]),
  acceptTerms: z.literal(true, { error: "Please accept the Terms and Privacy Policy" }),
});

export default api({
  POST: async (req, res) => {
    const ip = clientIp(req);
    await limit("signup", `ip:${ip}`);
    const body = parseBody(req, schema);
    await limit("signup", `email:${body.email}`);
    await signup({ ...body, ip });
    res.status(201).json({ ok: true, message: "Check your email for a confirmation link." });
  },
});
