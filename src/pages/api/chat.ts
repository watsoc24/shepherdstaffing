import { z } from "zod";
import { api, limit, parseBody } from "@/lib/api/handler";
import { forbidden } from "@/lib/api/errors";
import { requireAuth } from "@/lib/auth/guards";
import { chat, users } from "@/lib/db";
import { TRIAL_CHAT_LIMIT, getEntitlements } from "@/lib/billing/entitlements";
import { completeText } from "@/lib/ai/anthropic";

const schema = z.object({ message: z.string().trim().min(1).max(2000) });

const SYSTEM =
  "You are ShepherdAI, a coaching assistant for church hiring. You help candidates think through ministry roles and help churches think through who they need. Be practical and specific, grounded in what the user tells you. Never invent specific churches, candidates, or jobs. If you do not know something, say so. Keep answers short enough to read on a phone.";

/**
 * GET /api/chat — recent ShepherdAI history.
 * POST /api/chat — send a message. Trial members get 10 messages total
 * (atomic cap); paid members are unlimited within the 60/hour fair-use
 * rate limit. Both messages and usage are recorded.
 */
export default api({
  GET: async (req, res) => {
    const ctx = await requireAuth(req, res);
    const ent = await getEntitlements(ctx.user.id);
    if (ent.state !== "trial" && ent.state !== "paid") {
      throw forbidden("ShepherdAI chat is available on trial and membership. Choose a plan to keep going.");
    }
    const messages = await chat.recent(ctx.user.id, 20);
    res.status(200).json({ messages, remaining: ent.chatRemaining });
  },
  POST: async (req, res) => {
    const ctx = await requireAuth(req, res);
    const ent = await getEntitlements(ctx.user.id);
    if (ent.state !== "trial" && ent.state !== "paid") {
      throw forbidden("ShepherdAI chat is available on trial and membership. Choose a plan to keep going.");
    }
    await limit("chat", `user:${ctx.user.id}`);
    if (ent.state === "trial") {
      const ok = await users.incrementTrialChat(ctx.user.id, TRIAL_CHAT_LIMIT);
      // Lifetime trial cap (10 messages), not a rate limit — a 429's "wait a moment" would be a lie.
      if (!ok) throw forbidden("You've used your 10 trial messages. Choose a membership to keep chatting.");
    }
    const body = parseBody(req, schema);
    const history = await chat.recent(ctx.user.id, 10);
    await chat.add(ctx.user.id, "user", body.message);
    const { text, inputTokens, outputTokens, model } = await completeText({
      system: SYSTEM,
      messages: [
        ...history.map((m) => ({ role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: body.message },
      ],
    });
    await chat.add(ctx.user.id, "assistant", text);
    await chat.recordUsage({ userId: ctx.user.id, feature: "chat", model, inputTokens, outputTokens, ok: true });
    const remaining = ent.state === "trial" ? Math.max(0, TRIAL_CHAT_LIMIT - (await users.findById(ctx.user.id))!.trialChatCount) : "unlimited";
    res.status(200).json({ reply: text, remaining });
  },
});
