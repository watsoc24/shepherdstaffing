import { z } from "zod";
import { api, limit, parseBody } from "@/lib/api/handler";
import { requireAuth } from "@/lib/auth/guards";
import { requireEntitlement } from "@/lib/billing/entitlements";
import { messageText } from "@/lib/security/sanitize";
import { startThread } from "@/lib/messaging/threads";

const schema = z.object({ matchId: z.string().min(1), message: messageText });

/**
 * POST /api/threads/start — contact a match. Membership required
 * (canContact); the match must exist and not be dismissed. An open thread
 * is returned as-is; a declined one reopens with the new first message.
 */
export default api({
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    requireEntitlement(ctx, "canContact");
    await limit("messaging", `user:${ctx.user.id}`);
    const body = parseBody(req, schema);
    const result = await startThread({
      userId: ctx.user.id,
      canContact: true,
      matchId: body.matchId,
      firstMessage: body.message,
    });
    res.status(201).json({ ok: true, ...result });
  },
});
