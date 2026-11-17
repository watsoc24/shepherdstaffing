import { api } from "@/lib/api/handler";
import { unauthorized } from "@/lib/api/errors";
import { users } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmailSafe } from "@/lib/email/brevo";

/**
 * POST /api/cron/trial-reminders — the ops cron (Vercel Cron, once a day).
 * Guarded by CRON_SECRET, not by a session: callers send
 * `x-cron-secret`. Same-origin CSRF is off — a cron has no origin.
 * Sends a reminder 3 days before a trial ends, and expires trials that
 * have run out. Each user is touched once: the reminder flag and the
 * expired status are the idempotency.
 */
export default api(
  {
    POST: async (req, res) => {
      const secret = req.headers["x-cron-secret"];
      if (secret !== env().CRON_SECRET) throw unauthorized("Bad cron secret.");
      const now = new Date();
      const ending = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const reminders = await users.trialsEndingBetween(now, ending);
      for (const u of reminders) {
        await sendEmailSafe({
          to: u.email,
          subject: "Your Fit For Ministry trial ends in 3 days",
          text: `Hi ${u.name},\n\nYour Fit For Ministry trial ends on ${u.trialEndDate?.toISOString().slice(0, 10)}. Choose a membership in your dashboard to keep contacting matches and viewing full listings.\n\n— Fit For Ministry`,
          html: `<p>Hi ${u.name},</p><p>Your Fit For Ministry trial ends on ${u.trialEndDate?.toISOString().slice(0, 10)}. Choose a membership in your dashboard to keep contacting matches and viewing full listings.</p><p>— Fit For Ministry</p>`,
          tag: "trial-reminder",
        });
        await users.markTrialReminderSent(u.id);
      }
      const expired = await users.expiredTrials(now);
      for (const u of expired) {
        await users.markTrialExpired(u.id);
      }
      res.status(200).json({ ok: true, remindersSent: reminders.length, trialsExpired: expired.length });
    },
  },
  { csrf: false },
);
