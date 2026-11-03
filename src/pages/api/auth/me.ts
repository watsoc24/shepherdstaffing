import { api } from "@/lib/api/handler";
import { getAuth } from "@/lib/auth/guards";
import { publicUser } from "@/lib/auth/service";

export default api({
  GET: async (req, res) => {
    const ctx = await getAuth(req, res);
    if (!ctx) return res.status(200).json({ user: null, entitlements: null });
    res.json({ user: publicUser(ctx.user), entitlements: ctx.entitlements });
  },
});
