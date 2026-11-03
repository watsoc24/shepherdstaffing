import { env } from "../env";
import { log } from "../log";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
  tag?: string;
}

/** Messages "sent" without a Brevo key (test/dev). Tests read this; it's never used in production. */
export const outbox: Email[] = [];

export async function sendEmail(email: Email): Promise<void> {
  const e = env();
  if (!e.BREVO_API_KEY) {
    if (e.isProd) throw new Error("BREVO_API_KEY missing");
    outbox.push(email);
    if (e.NODE_ENV === "development") console.info(`[email:dev] to=${email.to} subject="${email.subject}"\n${email.text}`);
    return;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": e.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: e.EMAIL_FROM, name: e.EMAIL_FROM_NAME },
      to: [{ email: email.to }],
      subject: email.subject,
      textContent: email.text,
      htmlContent: email.html,
      tags: email.tag ? [email.tag] : undefined,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    log.error("email.send_failed", { status: res.status, tag: email.tag });
    throw new Error(`Brevo responded ${res.status}`);
  }
}

/** For non-critical notifications: log and continue instead of failing the request. */
export async function sendEmailSafe(email: Email) {
  try {
    await sendEmail(email);
  } catch (err) {
    log.error("email.send_failed_safe", { tag: email.tag, err: String(err) });
  }
}
