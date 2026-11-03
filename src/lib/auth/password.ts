import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { log } from "../log";

/** bcrypt, cost 12 (spec §10). */
const COST = 12;
export const MIN_LENGTH = 10;
// bcrypt only uses the first 72 bytes; reject longer input rather than silently truncating.
export const MAX_BYTES = 72;

export const hashPassword = (password: string) => bcrypt.hash(password, COST);

export async function verifyPassword(hash: string, password: string) {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

let dummy: string | undefined;
/** Equalizes timing when the email doesn't exist, so login can't enumerate accounts. */
export async function burnPasswordCheck(password: string) {
  dummy ??= await bcrypt.hash(crypto.randomBytes(16).toString("hex"), COST);
  await bcrypt.compare(password, dummy);
}

const COMMON = new Set([
  "password123", "password1234", "1234567890", "qwertyuiop", "iloveyou123", "letmein123", "welcome123",
  "jesuslovesme", "jesusislord", "blessed123", "godisgood1", "christ1234", "shepherd123", "ministry123",
  "pastor1234", "church1234", "faithhopelove", "praisethelord", "hallelujah", "1qaz2wsx3edc",
]);

export function validatePassword(password: string, email?: string): string | null {
  if (password.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters.`;
  if (Buffer.byteLength(password, "utf8") > MAX_BYTES) return "Use at most 72 characters.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "That password is too common. Try a short phrase only you would know.";
  if (/^(.)\1+$/.test(password)) return "That password is too easy to guess.";
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "Don't include your email name in your password.";
  return null;
}

/**
 * Optional breached-password check via HIBP k-anonymity: only the first 5 hex
 * chars of the SHA-1 leave the server. Fails open (network issues never block signup).
 * Disable with HIBP_CHECK=false.
 */
export async function isBreachedPassword(password: string): Promise<boolean> {
  if (process.env.HIBP_CHECK === "false" || process.env.NODE_ENV === "test") return false;
  const sha1 = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;
    const suffix = sha1.slice(5);
    return (await res.text()).split("\n").some((line) => {
      const [hash, count] = line.trim().split(":");
      return hash === suffix && Number(count) > 0;
    });
  } catch (err) {
    log.warn("hibp.unavailable", { err: String(err) });
    return false;
  }
}
