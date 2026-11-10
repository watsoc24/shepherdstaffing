import { env } from "../env";
import { BRAND } from "../brand";
import type { Email } from "./brevo";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface Parts {
  to: string;
  subject: string;
  tag: string;
  greeting: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footerNote?: string;
  unsubscribeUrl?: string; // non-transactional emails only
}

/** Branded plain-text + HTML email. All interpolated values are escaped. */
function render(p: Parts): Email {
  const app = env().NEXT_PUBLIC_APP_URL;
  const textLines = [
    p.greeting,
    "",
    ...p.paragraphs.flatMap((x) => [x, ""]),
    ...(p.cta ? [`${p.cta.label}: ${p.cta.url}`, ""] : []),
    ...(p.footerNote ? [p.footerNote, ""] : []),
    `— ${BRAND}`,
    app,
    ...(p.unsubscribeUrl ? ["", `Unsubscribe: ${p.unsubscribeUrl}`] : []),
  ];
  const html = `<!doctype html><html><body style="margin:0;background:#faf7f2;font-family:Helvetica,Arial,sans-serif;color:#0c0a09">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e2d9cb;border-radius:10px">
<tr><td style="padding:20px 24px;background:#0c0a09;border-radius:10px 10px 0 0;color:#faf7f2;font-family:Georgia,serif;font-size:22px">${esc(BRAND)}</td></tr>
<tr><td style="padding:24px;font-size:16px;line-height:1.6">
<p>${esc(p.greeting)}</p>
${p.paragraphs.map((x) => `<p>${esc(x)}</p>`).join("\n")}
${p.cta ? `<p style="margin:24px 0"><a href="${esc(p.cta.url)}" style="background:#5b21b6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">${esc(p.cta.label)}</a></p><p style="font-size:13px;color:#57534e">Or paste this link into your browser:<br>${esc(p.cta.url)}</p>` : ""}
${p.footerNote ? `<p style="font-size:13px;color:#57534e">${esc(p.footerNote)}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 24px;font-size:12px;color:#57534e;border-top:1px solid #e2d9cb">${esc(BRAND)} · <a href="${esc(app)}" style="color:#5b21b6">${esc(app.replace(/^https?:\/\//, ""))}</a>${p.unsubscribeUrl ? ` · <a href="${esc(p.unsubscribeUrl)}" style="color:#5b21b6">Unsubscribe</a>` : ""}</td></tr>
</table></td></tr></table></body></html>`;
  return { to: p.to, subject: p.subject, tag: p.tag, text: textLines.join("\n"), html };
}

const url = (path: string) => `${env().NEXT_PUBLIC_APP_URL}${path}`;
const first = (name: string) => name.trim().split(/\s+/)[0] || "there";

export const verificationEmail = (to: string, name: string, token: string) =>
  render({
    to,
    tag: "verification",
    subject: `Confirm your email for ${BRAND}`,
    greeting: `Hi ${first(name)},`,
    paragraphs: [
      "Please confirm your email address. Your 7-day free trial begins as soon as you do — no credit card needed.",
    ],
    cta: { label: "Confirm my email", url: url(`/verify-email?token=${encodeURIComponent(token)}`) },
    footerNote: "This link expires in 24 hours. If you didn't create an account, you can ignore this email.",
  });

export const alreadyRegisteredEmail = (to: string, name: string) =>
  render({
    to,
    tag: "already-registered",
    subject: `You already have a ${BRAND} account`,
    greeting: `Hi ${first(name)},`,
    paragraphs: ["Someone (hopefully you) tried to sign up with this email address, but you already have an account."],
    cta: { label: "Sign in", url: url("/login") },
    footerNote: "Forgot your password? Use the reset link on the sign-in page. If this wasn't you, no action is needed.",
  });

export const welcomeTrialEmail = (to: string, name: string, trialEnds: Date) =>
  render({
    to,
    tag: "welcome",
    subject: `Welcome to ${BRAND} — your trial has started`,
    greeting: `Welcome, ${first(name)}.`,
    paragraphs: [
      `Your free trial runs until ${trialEnds.toUTCString().slice(0, 16)}.`,
      "The single most important thing you can do now is complete your profile. Specific, honest detail is what drives strong matches.",
    ],
    cta: { label: "Build my profile", url: url("/dashboard") },
  });

export const passwordResetEmail = (to: string, name: string, token: string) =>
  render({
    to,
    tag: "password-reset",
    subject: `Reset your ${BRAND} password`,
    greeting: `Hi ${first(name)},`,
    paragraphs: ["We received a request to reset your password."],
    cta: { label: "Choose a new password", url: url(`/reset-password?token=${encodeURIComponent(token)}`) },
    footerNote: "This link expires in 1 hour and can be used once. If you didn't ask for this, you can ignore this email — your password won't change.",
  });

export const passwordChangedEmail = (to: string, name: string) =>
  render({
    to,
    tag: "password-changed",
    subject: `Your ${BRAND} password was changed`,
    greeting: `Hi ${first(name)},`,
    paragraphs: [
      "Your password was just changed and you've been signed out on other devices.",
      "If this wasn't you, reset your password right away and contact us.",
    ],
    cta: { label: "Reset password", url: url("/forgot-password") },
  });

export { render as _render };
