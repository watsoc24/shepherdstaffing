import { z } from "zod";
import { api, clientIp, limit, parseBody } from "@/lib/api/handler";
import { getAuth } from "@/lib/auth/guards";
import { inquiries } from "@/lib/db";
import { emailField, text } from "@/lib/security/sanitize";

const schema = z.object({
  contactName: text(120).pipe(z.string().min(1, "Please enter your name")),
  contactEmail: emailField,
  churchName: text(200).pipe(z.string().min(1, "Please enter the church name")),
  tier: z.enum(["assisted", "full"]),
  role: text(200).optional(),
  timeline: text(200).optional(),
  budget: text(200).optional(),
  churchSize: text(100).optional(),
  theology: text(500).optional(),
  notes: text(2000).optional(),
});

/**
 * POST /api/inquiries — public intake for the assisted/full recruiting
 * service. Open to anyone; linked to the signed-in user when one exists.
 * Every field is persisted (a first pass once dropped name/email/church).
 */
export default api({
  POST: async (req, res) => {
    const ip = clientIp(req);
    await limit("inquiry", `ip:${ip}`);
    const body = parseBody(req, schema);
    const auth = await getAuth(req, res);
    const row = await inquiries.create({ ...body, userId: auth?.user.id ?? null });
    res.status(201).json({ ok: true, inquiryId: row.id });
  },
});
