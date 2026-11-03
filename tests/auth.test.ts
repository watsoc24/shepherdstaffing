import { beforeEach, describe, expect, it } from "vitest";
import signup from "@/pages/api/auth/signup";
import verify from "@/pages/api/auth/verify";
import login from "@/pages/api/auth/login";
import me from "@/pages/api/auth/me";
import logoutAll from "@/pages/api/auth/logout-all";
import forgot from "@/pages/api/auth/forgot-password";
import reset from "@/pages/api/auth/reset-password";
import changePassword from "@/pages/api/auth/change-password";
import { db } from "@/lib/db/client";
import { outbox } from "@/lib/email/brevo";
import { sha256 } from "@/lib/security/crypto";
import { memoryKv } from "@/lib/security/redis";
import { resetMemoryLimits } from "@/lib/security/rateLimit";
import { resetDb } from "./helpers";
import { Client } from "./http";

const PW = "quiet morning prayer walk";
const tokenFrom = (to: string, kind: "verify-email" | "reset-password") => {
  const mail = [...outbox].reverse().find((m) => m.to === to && m.text.includes(`/${kind}?token=`))!;
  return decodeURIComponent(/token=([^\s&]+)/.exec(mail.text)![1]);
};

async function signupAndVerify(email: string, role: "candidate" | "church" = "candidate") {
  const c = new Client();
  expect((await c.call(signup, { body: { email, password: PW, name: "Sam Pastor", role, acceptTerms: true } })).status).toBe(201);
  const v = await c.call(verify, { body: { token: tokenFrom(email, "verify-email") } });
  expect(v.status).toBe(200);
  return c;
}

beforeEach(async () => {
  await resetDb();
  outbox.length = 0;
  memoryKv.clear();
  resetMemoryLimits();
});

describe("signup and email verification (defects #1, #4)", () => {
  it("stores only a SHA-256 hash of the verify token, with a 24h expiry", async () => {
    const c = new Client();
    await c.call(signup, { body: { email: "Sam@Example.com", password: PW, name: "Sam", role: "candidate", acceptTerms: true } });
    const token = tokenFrom("sam@example.com", "verify-email");
    const u = await db().user.findUniqueOrThrow({ where: { email: "sam@example.com" } });
    expect(u.verifyTokenHash).toBe(sha256(token));
    expect(u.verifyTokenHash).not.toContain(token);
    const hours = (u.verifyTokenExpires!.getTime() - Date.now()) / 3600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThanOrEqual(24);
    expect(u.passwordHash).toMatch(/^\$2[aby]\$12\$/); // bcrypt cost 12
    // Profile row and consents are created with the account.
    expect(await db().candidate.count({ where: { userId: u.id } })).toBe(1);
    expect(await db().consent.count({ where: { userId: u.id } })).toBe(2);
  });

  it("starts the trial at verification, not signup", async () => {
    const c = new Client();
    await c.call(signup, { body: { email: "a@x.com", password: PW, name: "A", role: "church", acceptTerms: true } });
    let u = await db().user.findUniqueOrThrow({ where: { email: "a@x.com" } });
    expect(u.trialStartDate).toBeNull();
    expect(u.subscriptionStatus).toBe("none");
    await c.call(verify, { body: { token: tokenFrom("a@x.com", "verify-email") } });
    u = await db().user.findUniqueOrThrow({ where: { email: "a@x.com" } });
    expect(u.subscriptionStatus).toBe("trial");
    const days = (u.trialEndDate!.getTime() - u.trialStartDate!.getTime()) / 86_400_000;
    expect(days).toBe(7);
    expect(Math.abs(u.trialStartDate!.getTime() - Date.now())).toBeLessThan(10_000);
  });

  it("verify tokens are single-use and expire", async () => {
    const c = new Client();
    await c.call(signup, { body: { email: "a@x.com", password: PW, name: "A", role: "candidate", acceptTerms: true } });
    const token = tokenFrom("a@x.com", "verify-email");
    expect((await c.call(verify, { body: { token } })).status).toBe(200);
    expect((await c.call(verify, { body: { token } })).status).toBe(400);

    await c.call(signup, { body: { email: "b@x.com", password: PW, name: "B", role: "candidate", acceptTerms: true } });
    const t2 = tokenFrom("b@x.com", "verify-email");
    await db().user.update({ where: { email: "b@x.com" }, data: { verifyTokenExpires: new Date(Date.now() - 1000) } });
    expect((await c.call(verify, { body: { token: t2 } })).status).toBe(400);
  });

  it("duplicate signup gives the same response and emails the owner instead", async () => {
    await signupAndVerify("a@x.com");
    const c = new Client();
    const again = await c.call(signup, { body: { email: "A@x.com", password: PW, name: "Imposter", role: "church", acceptTerms: true } });
    expect(again.status).toBe(201);
    expect(outbox.at(-1)!.subject).toMatch(/already have/);
    expect(await db().user.count()).toBe(1);
  });

  it("rejects weak passwords and missing consent", async () => {
    const c = new Client();
    const weak = await c.call(signup, { body: { email: "a@x.com", password: "short", name: "A", role: "candidate", acceptTerms: true } });
    expect(weak.status).toBe(400);
    expect(weak.json.error.details[0].path).toBe("password");
    const noTerms = await c.call(signup, { body: { email: "a@x.com", password: PW, name: "A", role: "candidate", acceptTerms: false } });
    expect(noTerms.status).toBe(400);
    const admin = await c.call(signup, { body: { email: "a@x.com", password: PW, name: "A", role: "admin", acceptTerms: true } });
    expect(admin.status).toBe(400);
  });
});

describe("login", () => {
  it("blocks unverified users", async () => {
    const c = new Client();
    await c.call(signup, { body: { email: "a@x.com", password: PW, name: "A", role: "candidate", acceptTerms: true } });
    const r = await c.call(login, { body: { email: "a@x.com", password: PW } });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe("EMAIL_NOT_VERIFIED");
    expect(c.cookie).toBe("");
  });

  it("uses one generic error for unknown email and wrong password", async () => {
    await signupAndVerify("a@x.com");
    const c = new Client();
    const unknown = await c.call(login, { body: { email: "nobody@x.com", password: PW } });
    const wrong = await c.call(login, { body: { email: "a@x.com", password: "wrong password!!" } });
    expect(unknown.status).toBe(401);
    expect(wrong.json.error.message).toBe(unknown.json.error.message);
  });

  it("sets an httpOnly SameSite=Lax cookie carrying only userId, role and sessionVersion", async () => {
    await signupAndVerify("a@x.com");
    const c = new Client();
    const r = await c.call(login, { body: { email: "a@x.com", password: PW } });
    expect(r.status).toBe(200);
    const cookie = String((r.setCookie as string[])[0]);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    const payload = JSON.parse(Buffer.from(c.cookie.split("=")[1].split(".")[1], "base64url").toString());
    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "role", "sub", "sv"]);
  });

  it("locks the account after 8 failures", async () => {
    await signupAndVerify("a@x.com");
    for (let i = 0; i < 8; i++) {
      const c = new Client(`198.51.100.${i}`); // spread across IPs so the per-IP limit isn't what trips
      await c.call(login, { body: { email: "a@x.com", password: "wrong password!!" } });
    }
    resetMemoryLimits();
    const r = await new Client().call(login, { body: { email: "a@x.com", password: PW } });
    expect(r.status).toBe(429);
    expect(r.json.error.code).toBe("ACCOUNT_LOCKED");
    expect(Number(r.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("rate-limits login per IP with Retry-After", async () => {
    const c = new Client("192.0.2.1");
    let last;
    for (let i = 0; i < 11; i++) last = await c.call(login, { body: { email: `x${i}@x.com`, password: "whatever123" } });
    expect(last!.status).toBe(429);
    expect(last!.headers["retry-after"]).toBeDefined();
  });

  it("promotes ADMIN_EMAILS to admin on first verified login", async () => {
    await signupAndVerify("boss@shepherdstaffing.com");
    const u = await db().user.findUniqueOrThrow({ where: { email: "boss@shepherdstaffing.com" } });
    expect(u.role).toBe("admin");
  });
});

describe("sessions", () => {
  it("logout-all revokes every outstanding cookie via sessionVersion", async () => {
    const phone = await signupAndVerify("a@x.com");
    const laptop = new Client();
    await laptop.call(login, { body: { email: "a@x.com", password: PW } });
    expect((await phone.call(me)).json.user.email).toBe("a@x.com");
    await laptop.call(logoutAll, { body: {} });
    expect((await phone.call(me)).json.user).toBeNull();
    expect((await laptop.call(me)).json.user).toBeNull();
  });

  it("rejects tampered cookies", async () => {
    const c = await signupAndVerify("a@x.com");
    const [name, jwt] = c.cookie.split("=");
    const [h, p, s] = jwt.split(".");
    const forged = JSON.parse(Buffer.from(p, "base64url").toString());
    forged.role = "admin";
    c.cookie = `${name}=${h}.${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${s}`;
    expect((await c.call(me)).json.user).toBeNull();
  });
});

describe("password reset", () => {
  it("is hashed, single-use, expires in 1h, and signs out other sessions", async () => {
    const session = await signupAndVerify("a@x.com");
    const c = new Client();
    const f1 = await c.call(forgot, { body: { email: "a@x.com" } });
    const f2 = await c.call(forgot, { body: { email: "ghost@x.com" } });
    expect(f1.json).toEqual(f2.json);

    const token = tokenFrom("a@x.com", "reset-password");
    const u = await db().user.findUniqueOrThrow({ where: { email: "a@x.com" } });
    expect(u.resetTokenHash).toBe(sha256(token));
    const mins = (u.resetTokenExpires!.getTime() - Date.now()) / 60_000;
    expect(mins).toBeGreaterThan(59);
    expect(mins).toBeLessThanOrEqual(60);

    expect((await c.call(reset, { body: { token, password: "a whole new phrase" } })).status).toBe(200);
    expect((await c.call(reset, { body: { token, password: "another new phrase" } })).status).toBe(400);
    expect((await session.call(me)).json.user).toBeNull();
    expect((await c.call(login, { body: { email: "a@x.com", password: "a whole new phrase" } })).status).toBe(200);
  });

  it("change-password keeps this device signed in and signs out others", async () => {
    const here = await signupAndVerify("a@x.com");
    const other = new Client();
    await other.call(login, { body: { email: "a@x.com", password: PW } });
    const r = await here.call(changePassword, { body: { currentPassword: PW, newPassword: "fresh new passphrase" } });
    expect(r.status).toBe(200);
    expect((await here.call(me)).json.user).not.toBeNull();
    expect((await other.call(me)).json.user).toBeNull();
  });
});

describe("CSRF", () => {
  it("rejects state-changing requests without a same-origin Origin/Referer", async () => {
    const c = new Client();
    const missing = await c.call(login, { body: { email: "a@x.com", password: PW }, origin: null });
    expect(missing.status).toBe(403);
    expect(missing.json.error.code).toBe("CSRF");
    const evil = await c.call(login, { body: { email: "a@x.com", password: PW }, origin: "https://evil.example" });
    expect(evil.status).toBe(403);
  });
});
